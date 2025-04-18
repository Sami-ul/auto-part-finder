// --- Dependencies ---
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const { parse } = require('csv-parse');
const { HttpsProxyAgent } = require('https-proxy-agent');

// --- Configuration ---
const config = {
    // File Paths
    vehicleCsvPath: 'vehicle_data.csv',
    outputCsvPath: 'rockauto_parts_output.csv',
    progressFilePath: 'scraper_progress.json',

    // Scraping Targets
    targetMakes: ['Honda', 'Toyota', 'Subaru', 'Chevrolet'],

    // Rate Limiting & Performance
    minDelayMs: 50,
    maxDelayMs: 100,
    enablePauseFeature: false,
    pauseIntervalMinutes: 5,
    pauseDurationMinutes: 1,
    axiosTimeout: 10000,
    maxRetries: 3, // Internal retries within makeRequest (includes port rotation)
    retryDelayMs: 200, // Delay between internal retries
    outerRetryPauseMs: 2000, // Pause before retrying SAME URL after all internal retries fail

    // --- Proxy Settings ---
    // NOTE: Set your proxy credentials and host below.
    // The script will automatically rotate ports within the specified range.
    proxyHost: 'gate.smartproxy.com',         // <-- SET YOUR PROXY HOST HERE
    proxyUsername: null,    // <-- SET YOUR PROXY USERNAME HERE
    proxyPassword: null,    // <-- SET YOUR PROXY PASSWORD HERE
    // --- Port Rotation Settings ---
    proxyPortStart: 10001,                  // Starting port of the range
    proxyPortEnd: 10030,                    // Ending port of the range
    proxyPortBlockDurationMs: 1 * 60 * 1000, // 1 minute block duration on failure

    // Operation Mode
    enableDebugLogging: false,
};

// --- Parts Dictionary ---
const partsDict = {
  "headlamp assembly": { parameters: "body+&+lamp+assembly,headlamp+assembly", partNum: "10762" },
  "brake pad": { parameters: "brake+&+wheel+hub,brake+pad", partNum: "1684" },
  "caliper": { parameters: "brake+&+wheel+hub,caliper", partNum: "1704" },
  "rotor": { parameters: "brake+&+wheel+hub,rotor", partNum: "1896" },
  "radiator": { parameters: "cooling+system,radiator", partNum: "2172" },
  "air filter": { parameters: "fuel+&+air,air+filter", partNum: "6192" },
  "cabin air filter": { parameters: "heat+&+air+conditioning,cabin+air+filter", partNum: "6832" },
  "ignition coil": { parameters: "ignition,ignition+coil", partNum: "7060" },
  "spark plug": { parameters: "ignition,spark+plug", partNum: "7212" },
  "wiper blade": { parameters: "wiper+&+washer,wiper+blade", partNum: "8852" },
};
const partKeys = Object.keys(partsDict);

// --- State Variables ---
let currentVehicleIndex = 0;
let currentPartKeyIndex = 0;
let isExiting = false;
// --- Port Rotation State ---
const blockedPorts = new Map(); // Map<portNumber, expiryTimestamp>

// --- Helper Functions ---
function logDebug(message) { if (config.enableDebugLogging) console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`); }
function logInfo(message) { console.log(`[INFO] ${new Date().toISOString()} - ${message}`); }
function logWarn(message) { console.warn(`[WARN] ${new Date().toISOString()} - ${message}`); }
function logError(message, error = null) {
    const errorMessage = error?.message || (typeof error === 'string' ? error : '');
    const errorDetails = config.enableDebugLogging ? (error?.stack || error) : errorMessage;
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, errorDetails || '');
}
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function getRandomDelay() { return Math.floor(Math.random() * (config.maxDelayMs - config.minDelayMs + 1)) + config.minDelayMs; }
function formatUrlSegment(str) { return String(str ?? '').toLowerCase().replace(/\s+/g, '+'); }
function escapeCsvField(field) {
    const stringField = String(field ?? '');
    if (stringField.includes(',') || stringField.includes('\n') || stringField.includes('"')) {
        return `"${stringField.replace(/"/g, '""')}"`;
    }
    return stringField;
}

// --- Port Rotation Logic ---
function blockPort(port, now) {
    const expiryTime = now + config.proxyPortBlockDurationMs;
    blockedPorts.set(port, expiryTime);
    logWarn(`Blocking port ${port} until ${new Date(expiryTime).toLocaleTimeString()}`);
}

async function selectNextAvailablePort() {
    while (true) {
        const now = Date.now();
        let earliestExpiry = Infinity;
        let earliestExpiryPort = null;

        for (let port = config.proxyPortStart; port <= config.proxyPortEnd; port++) {
            const expiryTime = blockedPorts.get(port);
            if (!expiryTime) {
                logDebug(`Selected available port: ${port}`);
                return port;
            }
            if (expiryTime <= now) {
                logDebug(`Port ${port} block expired. Unblocking and selecting.`);
                blockedPorts.delete(port);
                return port;
            }
            if (expiryTime < earliestExpiry) {
                earliestExpiry = expiryTime;
                earliestExpiryPort = port;
            }
        }

        const waitTime = earliestExpiry - now;
        if (waitTime > 0 && earliestExpiryPort !== null) {
             logWarn(`All proxy ports (${config.proxyPortStart}-${config.proxyPortEnd}) are currently blocked. Waiting ${Math.ceil(waitTime / 1000)}s for port ${earliestExpiryPort} (expires at ${new Date(earliestExpiry).toLocaleTimeString()}) to become available...`);
             await delay(waitTime + 100);
        } else {
             logDebug("Retrying port selection immediately after checking blocked ports (unexpected state or very short block).");
             await delay(100);
        }
    }
}

// --- Core Scraping Functions ---
// getCarCode, getIndexList, parseImageJson, extractPartData remain the same
function getCarCode(html, make, year, model, engine) {
    const $ = cheerio.load(html);
    let foundRecord = null;
    $('div.ranavnode input[id^="jsn"]').each((i, elem) => {
        const rawValue = $(elem).attr('value') || '';
        let jsonStr = rawValue;
        try {
            if (jsonStr.startsWith('"') && jsonStr.endsWith('"')) {
                 jsonStr = JSON.parse(jsonStr);
            }
            const data = JSON.parse(jsonStr);
            if (data?.make?.toLowerCase().includes(make.toLowerCase()) &&
                data.year !== undefined && String(data.year) === String(year) &&
                data.model?.toLowerCase().includes(model.toLowerCase()) &&
                data.engine?.toLowerCase().includes(engine.toLowerCase())
            ) {
                foundRecord = data.carcode;
                logDebug(`Found carcode: ${foundRecord} for ${make} ${year} ${model} ${engine}`);
                return false; // Stop .each
            }
        } catch (err) { logDebug(`Ignoring JSON parse error for carcode candidate: ${err.message}. Raw value: ${rawValue.substring(0,100)}...`); }
    });
    if (!foundRecord) logInfo(`Carcode NOT found for ${make} ${year} ${model} ${engine}`);
    return foundRecord;
}

function getIndexList(html, partNum) {
    try {
        const $ = cheerio.load(html);
        const idPat = new RegExp(`^navnodeunique\\[[^\\]]*${partNum}\\]$`, "i");
        const v = $('div.ranavnode input[type="hidden"]').filter((_, el) => idPat.test($(el).attr("id") || "")).first().attr("value");
        if (!v) { logDebug(`Could not find navnodeunique value for partNum ${partNum}`); return null; }
        const listingsContainer = $(`#navchildren\\[${v}\\]`).find("div.listings-container").first();
        if (!listingsContainer.length) { logDebug(`Could not find listings-container for nav value ${v}`); return null; }
        const listIdMatch = listingsContainer.attr("id")?.match(/\[(\d+)\]/);
        if (!listIdMatch?.[1]) { logDebug(`Could not extract list ID from listings container ID: ${listingsContainer.attr("id")}`); return null; }
        const listId = listIdMatch[1];
        const indexListInput = $(`#part_groupindexes_in_this_listing\\[${listId}\\]`);
        const str = indexListInput.attr("value");
        if (!str) {
            if ($(html).text().includes("No parts are listed for this vehicle")) {
                 logDebug(`"No parts listed" message found for partNum ${partNum}.`);
                 return [];
            }
            logDebug(`Index list input not found for list ID ${listId} (partNum ${partNum}) and no explicit 'no parts' message.`);
            return null;
        }
        return JSON.parse(str).map(Number);
    } catch (error) { logError(`Error in getIndexList for partNum ${partNum}`, error); return null; }
}

function parseImageJson(jsonStr) {
    let fimglinks = [], timglinks = [];
    const baseUrl = "https://www.rockauto.com";
    if (!jsonStr) return { fimglink: '', timglink: '' };
    try {
        let cleanedJsonStr = jsonStr.replace(/\\\//g, '/');
        if (cleanedJsonStr.startsWith('"') && cleanedJsonStr.endsWith('"')) {
            try {
                cleanedJsonStr = JSON.parse(cleanedJsonStr);
            } catch (innerErr) {
                 logDebug(`Failed to parse potentially double-quoted JSON string: ${innerErr.message}`);
            }
        }
        let data = JSON.parse(cleanedJsonStr);
        const slots = data?.Slots ?? [];
        slots.forEach(slot => {
            if (slot.ImageData?.Full) fimglinks.push(`${baseUrl}${slot.ImageData.Full}`);
            if (slot.ImageData?.Thumb) timglinks.push(`${baseUrl}${slot.ImageData.Thumb}`);
        });
    } catch (error) { logError(`Failed to parse image JSON: ${jsonStr.substring(0, 100)}...`, error); }
    return { fimglink: fimglinks.join(','), timglink: timglinks.join(',') };
}

function extractPartData($, idx) {
    const partData = { brand: "N/A", partNumber: "N/A", description: "N/A", price: "N/A", core: "N/A", pack: "N/A", total: "N/A", fits: "N/A", fimglink: '', timglink: '' };
    try {
        const tbody = $(`tbody#listingcontainer\\[${idx}\\]`).first();
        if (!tbody.length) { logDebug(`Could not find tbody#listingcontainer[${idx}]`); return null; }
        partData.brand = tbody.find("span.listing-final-manufacturer").first().text().trim() || "N/A";
        partData.partNumber = tbody.find("span.listing-final-partnumber").first().text().trim() || "N/A";
        partData.description = tbody.find("span.span-link-underline-remover").first().text().trim() || "N/A";
        partData.price = $(`span#dprice\\[${idx}\\]\\[v\\]`).first().text().trim() || "N/A";
        partData.core = $(`span#dcore\\[${idx}\\]\\[v\\]`).first().text().trim() || "N/A";
        partData.pack = $(`span#dpack\\[${idx}\\]\\[v\\]`).first().text().trim() || "N/A";
        partData.total = $(`span#dtotal\\[${idx}\\]\\[v\\]`).first().text().trim() || "N/A";
        partData.fits = tbody.find("span.listing-footnote-text").map((_, el) => $(el).text().trim()).get().join('; ') || "N/A";
        const imageLinks = parseImageJson($(`#jsninlineimg\\[${idx}\\]`).attr("value"));
        partData.fimglink = imageLinks.fimglink;
        partData.timglink = imageLinks.timglink;
        logDebug(`Extracted Part Data for index ${idx}: Brand=${partData.brand}, Part#=${partData.partNumber}`);
        return partData;
    } catch (error) { logError(`Error extracting data for part index ${idx}`, error); return null; }
}

// --- Progress Management ---
async function saveProgress(vehicleIdx, partIdx) {
    const progress = {
        vehicleIndex: vehicleIdx,
        partKeyIndex: partIdx,
        timestamp: new Date().toISOString()
    };
    try {
        await fsPromises.writeFile(config.progressFilePath, JSON.stringify(progress, null, 2));
        logDebug(`Progress saved: Vehicle Index=${vehicleIdx}, Part Key Index=${partIdx}`);
    } catch (error) {
        logError('Failed to save progress file!', error);
    }
}

async function loadProgress() {
    try {
        const data = await fsPromises.readFile(config.progressFilePath, 'utf8');
        const progress = JSON.parse(data);
        currentVehicleIndex = progress.vehicleIndex || 0;
        currentPartKeyIndex = progress.partKeyIndex || 0;
        logInfo(`Resuming from progress: Vehicle Index=${currentVehicleIndex}, Part Key Index=${currentPartKeyIndex}`);
        return { startVehicleIndex: currentVehicleIndex, startPartKeyIndex: currentPartKeyIndex };
    } catch (error) {
        if (error.code !== 'ENOENT') logError('Error reading progress file. Starting from beginning.', error);
        else logInfo('No progress file found. Starting from the beginning.');
        currentVehicleIndex = 0;
        currentPartKeyIndex = 0;
        return { startVehicleIndex: 0, startPartKeyIndex: 0 };
    }
}

// --- Axios Request Function with Proxy, Retries, and Port Rotation ---
// This function attempts the request up to `maxRetries + 1` times, rotating ports on failure.
// It throws an error only if all attempts fail OR if a fatal error (like 407) occurs.
async function makeRequest(url) {
    let lastError = null;
    let portToUse = null;

    portToUse = await selectNextAvailablePort(); // Select initial port

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
        const currentPortForAttempt = portToUse;
        const isRetry = attempt > 0;

        if (isRetry) {
            logWarn(`Retrying request to ${url} (Attempt ${attempt}/${config.maxRetries}) using port ${currentPortForAttempt}. Waiting ${config.retryDelayMs}ms...`);
            await delay(config.retryDelayMs);
        } else {
            logDebug(`Attempt 0: Making request to ${url} using port ${currentPortForAttempt}.`);
        }

        const axiosConfig = {
            headers: { 'User-Agent': config.userAgent },
            timeout: config.axiosTimeout,
            validateStatus: (status) => status >= 200 && status < 500,
            httpsAgent: undefined,
            proxy: undefined,
        };

        const isHttps = url.startsWith('https://');
        const useProxy = config.proxyHost && config.proxyUsername && config.proxyPassword;

        if (isHttps && useProxy) {
            let proxyUrl = `http://`;
            proxyUrl += `${encodeURIComponent(config.proxyUsername)}:${encodeURIComponent(config.proxyPassword)}@`;
            proxyUrl += `${config.proxyHost}:${currentPortForAttempt}`;

            logDebug(`[Attempt ${attempt}, Port ${currentPortForAttempt}] Using HttpsProxyAgent with URL: ${proxyUrl.replace(/:[^:@\/]+@/, ':<PASSWORD_HIDDEN>@')} for target: ${url}`);
            try {
                axiosConfig.httpsAgent = new HttpsProxyAgent(proxyUrl);
                axiosConfig.proxy = false;
            } catch (agentError) {
                 logError(`[Attempt ${attempt}, Port ${currentPortForAttempt}] Fatal: Failed to create HttpsProxyAgent.`, agentError);
                 lastError = agentError;
                 lastError.isFatal = true; // Mark as fatal
                 break; // Exit retry loop immediately
            }
        } else {
            logDebug(`[Attempt ${attempt}] Making direct request (no proxy) to ${url}`);
        }

        logDebug(`[Attempt ${attempt}, Port ${currentPortForAttempt}] Making request to: ${url}`);
        try {
            await delay(getRandomDelay());
            const response = await axios.get(url, axiosConfig);

            if (response.status === 407) {
                logError(`Request FAILED with status 407 (Proxy Authentication Required) using port ${currentPortForAttempt}. Credentials or IP Whitelist likely incorrect. NO RETRY.`);
                lastError = new Error(`Proxy Authentication Required (407)`);
                lastError.response = response;
                lastError.isFatal = true; // Mark as fatal
                break; // Exit retry loop immediately
            } else if (response.status >= 400) {
                logWarn(`Request to ${url} failed on attempt ${attempt} using port ${currentPortForAttempt} with status ${response.status}. Blocking port.`);
                blockPort(currentPortForAttempt, Date.now());
                lastError = new Error(`Request failed with status code ${response.status}`);
                lastError.response = response;
                lastError.isFatal = false; // Mark as non-fatal for outer loop handling
                if (attempt < config.maxRetries) {
                    portToUse = await selectNextAvailablePort(); // Get new port for next attempt
                }
                // Continue to next retry attempt
            } else {
                logDebug(`Request to ${url} successful on attempt ${attempt} using port ${currentPortForAttempt} with status ${response.status}`);
                return response; // Success!
            }

        } catch (error) {
            logWarn(`Request to ${url} failed on attempt ${attempt} using port ${currentPortForAttempt} during execution. Error: ${error.message}. Blocking port.`);
            blockPort(currentPortForAttempt, Date.now());
            lastError = error;
            lastError.isFatal = false; // Network/execution errors are generally not fatal for the script run
            if (attempt < config.maxRetries) {
                 portToUse = await selectNextAvailablePort(); // Get new port for next attempt
            }
            // Continue to next retry attempt
        }
    } // End of retry loop

    // If loop finished without returning successfully
    logError(`Internal retries failed for ${url} after ${config.maxRetries} attempts.`);
    if(lastError?.isFatal) {
        logError("Failure was marked as fatal (e.g., 407 Auth Error or Agent Creation Failed).");
    }
    // Throw the last error encountered; the outer loop will decide whether to retry indefinitely or terminate.
    throw lastError;
}

// --- Graceful Exit Handler ---
process.on('SIGINT', async () => {
  if (isExiting) return;
  isExiting = true;
  logInfo('\nCTRL+C detected. Attempting to save progress before exiting...');
  await saveProgress(currentVehicleIndex, currentPartKeyIndex);
  logInfo('Progress saved. Exiting now.');
  process.exit(130);
});


// --- Main Scraping Logic ---
async function main() {
    logInfo("Starting RockAuto Parts Scraper...");
    await loadProgress();
    const loopStartVehicleIndex = currentVehicleIndex;
    const loopStartPartKeyIndex = currentPartKeyIndex;
    
    // --- Load, Filter, Sort Vehicle Data ---
    let vehicleRows = [];
    try {
        logInfo(`Loading vehicle data from ${config.vehicleCsvPath}...`);
        const parser = fs.createReadStream(config.vehicleCsvPath).pipe(parse({ columns: ['make', 'year', 'model', 'engine'], from_line: 2, trim: true, skip_empty_lines: true }));
        const targetMakesLower = config.targetMakes.map(m => m.toLowerCase());
        for await (const record of parser) {
             if (record.make && record.year && record.model && record.engine && targetMakesLower.includes(record.make.toLowerCase())) {
                if (!isNaN(parseInt(record.year, 10))) {
                    vehicleRows.push(record);
                } else {
                    logDebug(`Skipping record with invalid year format: ${JSON.stringify(record)}`);
                }
             } else if (record.make && targetMakesLower.includes(record.make.toLowerCase())) {
                 logDebug(`Skipping incomplete record for target make ${record.make}: ${JSON.stringify(record)}`);
             }
        }
        logInfo(`Loaded ${vehicleRows.length} valid vehicle rows matching target makes.`);
        if (vehicleRows.length === 0) { logInfo("No vehicles found to process. Exiting."); process.exit(0); }
        logInfo("Sorting vehicle data by Make (asc), Year (desc)...");
        vehicleRows.sort((a, b) => a.make.toLowerCase().localeCompare(b.make.toLowerCase()) || parseInt(b.year, 10) - parseInt(a.year, 10));
        logInfo("Sorting complete.");
    } catch (error) { logError('Fatal Error: Could not load or parse vehicle CSV file.', error); process.exit(1); }

    // --- Prepare Output CSV ---
    const outputHeader = 'make,year,model,engine,part,brand,partnumber,description,price,core,pack,total,fits,fimglink,timglink\n';
    if (loopStartVehicleIndex === 0 && loopStartPartKeyIndex === 0) {
        try { await fsPromises.writeFile(config.outputCsvPath, outputHeader); logInfo(`Output file ${config.outputCsvPath} created/overwritten.`); }
        catch (error) { logError(`Fatal Error: Could not write header to output file ${config.outputCsvPath}`, error); process.exit(1); }
    } else { logInfo(`Appending to existing output file ${config.outputCsvPath}`); }

    // --- Pause Timer Setup ---
    let lastPauseTime = Date.now();
    const pauseIntervalMs = config.pauseIntervalMinutes * 60 * 1000;
    const pauseDurationMs = config.pauseDurationMinutes * 60 * 1000;

    // --- Main Processing Loop ---
    logInfo(`Starting main processing loop from Vehicle Index: ${loopStartVehicleIndex}, Part Index: ${loopStartPartKeyIndex}`);
    let currentMakeBeingProcessed = null;
    let loopCurrentPartKeyIndex = loopStartPartKeyIndex;

    for (let i = loopStartVehicleIndex; i < vehicleRows.length; i++) {
        currentVehicleIndex = i;
        const vehicle = vehicleRows[i];
        const { make, year, model, engine } = vehicle;
        const yearInt = parseInt(year, 10);

        const isNewMake = (make !== currentMakeBeingProcessed);
        if (isNewMake) {
            currentMakeBeingProcessed = make;
            logInfo(`\n--- Starting processing for Make: ${currentMakeBeingProcessed} ---`);
            if (i > loopStartVehicleIndex || loopStartPartKeyIndex === 0) {
                 loopCurrentPartKeyIndex = 0;
                 currentPartKeyIndex = 0;
                 logDebug(`Starting make ${currentMakeBeingProcessed} from part index 0.`);
            } else {
                 logDebug(`Resuming make ${currentMakeBeingProcessed} at part index ${loopCurrentPartKeyIndex}`);
            }
        } else {
             if (i === loopStartVehicleIndex && loopStartPartKeyIndex > 0){
                loopCurrentPartKeyIndex = loopStartPartKeyIndex;
             }
        }

        // --- Year Optimization Check (< 2015) ---
        if (yearInt < 2015) {
            logInfo(`Encountered year ${yearInt} (< 2015) for make ${currentMakeBeingProcessed}. Skipping rest of this make.`);
            let nextMakeIndex = vehicleRows.findIndex((row, idx) => idx > i && row.make !== currentMakeBeingProcessed);
            if (nextMakeIndex !== -1) {
                logDebug(`Jumping index from ${i} to ${nextMakeIndex} for next make.`);
                currentVehicleIndex = nextMakeIndex;
                currentPartKeyIndex = 0;
                await saveProgress(currentVehicleIndex, currentPartKeyIndex);
                i = nextMakeIndex - 1;
            } else {
                logInfo("No subsequent makes found. Ending processing.");
                currentVehicleIndex = vehicleRows.length;
                currentPartKeyIndex = 0;
                await saveProgress(currentVehicleIndex, currentPartKeyIndex);
                i = vehicleRows.length;
            }
            loopCurrentPartKeyIndex = 0;
            continue;
        }

        logInfo(`--- Processing Vehicle ${i + 1}/${vehicleRows.length}: ${make} ${year} ${model} ${engine} ---`);

        // --- Get Car Code (with indefinite outer retry) ---
        let carcode = null;
        const vehicleUrl = `https://www.rockauto.com/en/catalog/${formatUrlSegment(make)},${year},${formatUrlSegment(model)},${formatUrlSegment(engine)}`;
        let vehicleFetchSuccess = false;
        let skipVehicle = false;

        while (!vehicleFetchSuccess && !skipVehicle) {
            try {
                currentPartKeyIndex = loopCurrentPartKeyIndex; // Sync global state
                logDebug(`Attempting fetch for vehicle page: ${vehicleUrl}`);
                const response = await makeRequest(vehicleUrl); // Tries internal retries/ports

                carcode = getCarCode(response.data, make, year, model, engine);
                if (!carcode) {
                    logInfo(`Skipping vehicle ${make} ${year} ${model} ${engine} due to missing carcode (after successful fetch).`);
                    await saveProgress(i + 1, 0);
                    loopCurrentPartKeyIndex = 0;
                    skipVehicle = true; // Break while loop, skip parts processing
                } else {
                    logDebug(`Obtained carcode: ${carcode}`);
                    vehicleFetchSuccess = true; // Break while loop, proceed to parts
                }

            } catch (error) {
                // Caught error *after* makeRequest failed all internal retries
                if (error.isFatal) {
                     const status = error.response?.status;
                     logError(`FATAL ERROR during fetch for ${vehicleUrl}. Status: ${status || 'N/A'}. Terminating.`);
                     await saveProgress(currentVehicleIndex, currentPartKeyIndex);
                     process.exit(1); // Terminate on fatal errors
                } else {
                    const status = error.response?.status;
                    logError(`FETCH FAILED for ${vehicleUrl} after all internal retries. Status: ${status || 'N/A'}. Pausing ${config.outerRetryPauseMs / 1000}s before retrying SAME URL.`);
                    await delay(config.outerRetryPauseMs); // Pause before outer retry
                    // Loop continues automatically
                }
            }
        } // End while (!vehicleFetchSuccess && !skipVehicle)

        if (skipVehicle) {
            continue; // Skip to next vehicle in outer 'for i' loop
        }

        // --- Iterate Through Parts ---
        for (let j = loopCurrentPartKeyIndex; j < partKeys.length; j++) {
            currentPartKeyIndex = j; // Update global state
            const partKey = partKeys[j];
            const partInfo = partsDict[partKey];
            logInfo(`Processing Part Type ${j + 1}/${partKeys.length}: "${partKey}" for ${make} ${year} ${model}`);

            if (config.enablePauseFeature && (Date.now() - lastPauseTime > pauseIntervalMs)) {
                logInfo(`Pausing for ${config.pauseDurationMinutes} minute(s)...`);
                await saveProgress(currentVehicleIndex, currentPartKeyIndex);
                await delay(pauseDurationMs);
                logInfo("Resuming scraping.");
                lastPauseTime = Date.now();
            }

            // --- Get Parts Page (with indefinite outer retry) ---
            const partsUrl = `https://www.rockauto.com/en/catalog/${formatUrlSegment(make)},${year},${formatUrlSegment(model)},${formatUrlSegment(engine)},${carcode},${formatUrlSegment(partInfo.parameters)},${partInfo.partNum}`;
            let partsHtml = null;
            let partFetchSuccess = false;

            while (!partFetchSuccess) {
                try {
                    logDebug(`Attempting fetch for parts page: ${partsUrl}`);
                    const response = await makeRequest(partsUrl); // Includes internal retries & port rotation
                    partsHtml = response.data;
                    logDebug(`Successfully fetched parts page for "${partKey}"`);
                    partFetchSuccess = true; // Break while loop

                } catch (error) {
                    // Caught error *after* makeRequest failed all internal retries
                    if (error.isFatal) {
                        const status = error.response?.status;
                        logError(`FATAL ERROR during fetch for ${partsUrl}. Status: ${status || 'N/A'}. Terminating.`);
                        await saveProgress(currentVehicleIndex, currentPartKeyIndex);
                        process.exit(1); // Terminate on fatal errors
                    } else {
                        const status = error.response?.status;
                        logError(`FETCH FAILED for ${partsUrl} after all internal retries. Status: ${status || 'N/A'}. Pausing ${config.outerRetryPauseMs / 1000}s before retrying SAME URL.`);
                        await delay(config.outerRetryPauseMs); // Pause before outer retry
                        // Loop continues automatically
                    }
                }
            } // End while (!partFetchSuccess)


            // --- Extract and Append Data --- (Only runs after successful fetch)
            const $ = cheerio.load(partsHtml);
            const partIndexes = getIndexList(partsHtml, partInfo.partNum);

            if (partIndexes === null) {
                logError(`Failed to get part indexes for "${partKey}". Skipping this part type for this vehicle.`);
            } else if (partIndexes.length === 0) {
                logInfo(`No parts found listed for "${partKey}".`);
            } else {
                logInfo(`Found ${partIndexes.length} parts for "${partKey}". Extracting...`);
                let partsFoundCount = 0;
                for (const idx of partIndexes) {
                    const extractedData = extractPartData($, idx);
                    if (extractedData) {
                        partsFoundCount++;
                        const outputRow = [
                            make, year, model, engine, partKey, extractedData.brand, extractedData.partNumber,
                            extractedData.description, extractedData.price, extractedData.core, extractedData.pack,
                            extractedData.total, extractedData.fits, extractedData.fimglink, extractedData.timglink
                        ].map(escapeCsvField).join(',') + '\n';
                        try {
                            await fsPromises.appendFile(config.outputCsvPath, outputRow);
                            logDebug(`Appended part: ${extractedData.brand} - ${extractedData.partNumber}`);
                        } catch (error) {
                            logError(`Fatal Error: Failed to append row to output CSV ${config.outputCsvPath}. Terminating.`, error);
                            await saveProgress(currentVehicleIndex, currentPartKeyIndex);
                            process.exit(1);
                        }
                    } else {
                        logError(`Failed to extract data for part index ${idx} of type "${partKey}".`);
                    }
                }
                logDebug(`Extracted ${partsFoundCount} parts for type "${partKey}".`);
            }

            // Save progress pointing to the *next* part type (j + 1)
             await saveProgress(currentVehicleIndex, j + 1);

        } // End loop through partKeys

        loopCurrentPartKeyIndex = 0; // Reset loop's part index for next vehicle
        await saveProgress(i + 1, 0); // Save progress for next vehicle (i+1, part 0)

    } // End loop through vehicleRows

    logInfo("\n--- Scraping Completed Successfully! ---");
}

// --- Run the Scraper ---
main().catch(error => {
    logError("An unexpected fatal error occurred at the top level:", error);
    process.exit(1);
});
