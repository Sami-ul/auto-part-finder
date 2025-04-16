const searchResults = document.getElementById('search-results');
const addressInput = document.getElementById('address');
let lastSearched;
let debounce;
var map = L.map('map').setView([40.0190, -105.2747], 13);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

addressInput.addEventListener('input', function() {
    const searchAddress = this.value.trim();
    if (searchAddress.length < 3 || lastSearched == searchAddress) {
        searchResults.style.display = 'none';
        return;
    }
    lastSearched=searchAddress;

    clearTimeout(debounce);
    
    debounce = setTimeout(() => {
        suggestAddresses(searchAddress);
    }, 200);
});

async function suggestAddresses(query) {
    searchResults.innerHTML = '';
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
            format: 'json',
            q: query + ', USA',
            limit: 3,
            countrycodes: 'us',
            addressdetails: 1,
            featuretype: 'housenumber',
        },
    });
    
    if (response.data.length > 0) {
        for (let i = 0; i < response.data.length; i++) {
            const addressElement = response.data[i].display_name;
            const div = document.createElement('div');
            div.className = "addressResultElement";
            div.textContent = addressElement;
            
            div.addEventListener('click', function() {
                addressInput.value = addressElement;
                searchResults.style.display = 'none';
                const addressArray = (formatAddress(response.data[i]))
                autofill(addressArray)
                markOnMap(response.data[i].lat, response.data[i].lon, addressArray[0])
                findAutoPartsStores(response.data[i].lat, response.data[i].lon);
            });
            
            searchResults.appendChild(div);
        }
        
        searchResults.style.display = 'block';
    } else {
        searchResults.style.display = 'none';
    }
}

function formatAddress(place) {
    const addr = place.address;
    let street_address = ''
    if (addr.house_number) {
        street_address = addr.house_number + ' ' + addr.road;
    }
    else {
        street_address = addr.road;
    }
    let city = addr.city || addr.town || addr.village || addr.county;
    let state = addr.state;
    let postal_code = addr.postcode;
    let country = addr.country;

    return [street_address, city, state, postal_code, country]
  }

function autofill(addressArray) {
    const [street_address, city, state, postal_code, country] = addressArray;
  const countrySelect = document.getElementById('country');
  const stateSelect = document.getElementById('state');
  document.getElementById('street_address').value = street_address;
  document.getElementById('city').value = city;
  document.getElementById('postal_code').value = postal_code;
  
  for (let i = 0; i < stateSelect.options.length; i++) {
    if (stateSelect.options[i].text === state) {
      stateSelect.selectedIndex = i;
      break;
    } 
  }

  for (let i = 0; i < countrySelect.options.length; i++) {
    if (countrySelect.options[i].text === country) {
      countrySelect.selectedIndex = i;
      break;
    }
  }
    
}


function markOnMap(lat, long, street_address){
    var marker = L.marker([lat, long]).addTo(map);
    marker.bindPopup(street_address).openPopup();
    map.setView([lat, long], 15);
}

let storeMarkers = [];

async function findAutoPartsStores(lat, lon) {
    // Clear previous markers
    clearStoreMarkers();
    
    try {
        // Use Overpass API to find auto parts stores
        const overpassApi = 'https://overpass-api.de/api/interpreter';
        const radius = 5000; // 5km radius
        
        const query = `
        [out:json];
        node(around:${radius},${lat},${lon})
          ["shop"="car_parts"];
        out body;
        node(around:${radius},${lat},${lon})
          ["shop"="car_repair"];
        out body;
        node(around:${radius},${lat},${lon})
          ["amenity"="car_parts"];
        out body;
        `;
        
        const response = await axios.post(overpassApi, query);
        
        if (response.data && response.data.elements) {
            const storeIcon = L.icon({
                iconUrl: '../img/maintenance.png',
                iconSize: [25, 25],
                iconAnchor: [12, 25],
                popupAnchor: [0, -25]
            });

            
            response.data.elements.forEach(store => {
                const marker = L.marker([store.lat, store.lon], {icon: storeIcon}).addTo(map);
                const storeName = store.tags.name || 'Auto Parts Store';
                const storeType = store.tags.shop || store.tags.amenity || '';
                
                marker.bindPopup(`<strong>${storeName}</strong>`);
                storeMarkers.push(marker);
            });
            
            if (response.data.elements.length === 0) {
                alert('No auto parts stores found in this area.');
            } else {
                console.log(`Found ${response.data.elements.length} auto parts stores nearby.`);
            }
        }
    } catch (error) {
        console.error('Error finding auto parts stores:', error);
        alert('Error searching for auto parts stores. Please try again.');
    }
}

function clearStoreMarkers() {
    storeMarkers.forEach(marker => {
        map.removeLayer(marker);
    });
    storeMarkers = [];
}

findAutoPartsStores(40.0190, -105.2747);