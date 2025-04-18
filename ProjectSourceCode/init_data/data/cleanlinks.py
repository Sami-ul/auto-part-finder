import pandas as pd
import re
import sys
import csv
# Import tqdm safely
try:
    from tqdm import tqdm
    TQDM_AVAILABLE = True
except ImportError:
    TQDM_AVAILABLE = False
    class TqdmDummy:
        @staticmethod
        def pandas(*args, **kwargs): pass
        @staticmethod
        def write(*args, **kwargs): print(*args, **kwargs)
    tqdm = TqdmDummy()
    print("Warning: tqdm library not found. Progress bars will not be shown.", file=sys.stderr)
    print("         Install using: pip install tqdm", file=sys.stderr)


# --- Configuration ---
COLUMN_NAMES = [ # Expected headers (lowercase for internal use)
    'make', 'year', 'model', 'engine', 'part', 'brand', 'partnumber',
    'description', 'price', 'core', 'pack', 'total', 'fits',
    'fullimg', 'thumbimg'
]
YEAR_COL = 'year'
PART_COL = 'part'
PRICE_COL = 'price'
CORE_COL = 'core'
TOTAL_COL = 'total'
FITS_COL = 'fits'
FULLIMG_COL = 'fullimg'
THUMBIMG_COL = 'thumbimg'
MIN_YEAR = 2015
PARTS_TO_EXCLUDE = {
    "thermostat", "water pump", "oil", "oil filter", "catalytic converter"
}

# --- Helper Functions ---
def normalize_currency(value):
    """
    Cleans currency strings to numeric strings based on examples.
    Returns empty string "" for values to be filtered out (Out of Stock, N/A, unparseable).
    """
    if pd.isna(value): return ""
    text = str(value).strip()

    # Handle exact filter-out cases (case-insensitive)
    if text.lower() in ["n/a", "out of stock"]: return ""
    if not text: return "" # Handle empty string case

    # Step 1: Remove parentheses if they surround the value
    if text.startswith('(') and text.endswith(')'):
        text = text[1:-1].strip()

    # Step 2: Remove known trailing text (case-insensitive)
    text = re.sub(r'/Each$', '', text, flags=re.IGNORECASE).strip()

    # Step 3: Remove known prefixes (case-insensitive for letters)
    # Order matters slightly - remove longer prefixes first
    text = re.sub(r'^[Mm][Ee][Xx]\$', '', text).strip()
    text = re.sub(r'^[Rr]\$', '', text).strip()
    text = re.sub(r'^[$€]', '', text).strip() # $ or €

    # Step 4: Remove internal commas (thousands separators)
    text = text.replace(',', '')

    # Step 5: Final whitespace strip
    text = text.strip()

    # Step 6: Validate if it's a number (integer or float, possibly negative)
    # Allows optional decimal point, requires at least one digit
    if re.fullmatch(r'-?(?:\d+(?:\.\d*)?|\.\d+)', text):
        # Prepend 0 if it starts with just "." or "-."
        if text.startswith('.'): text = '0' + text
        elif text.startswith('-.'): text = '-0' + text[1:]
        return text # Return the valid numeric string
    else:
        # If after all cleaning it's still not a valid number, treat as invalid
        return ""

def extract_first_url(value):
    # (Same as previous version - verified working)
    if pd.isna(value): return ""
    text = str(value).strip()
    if not text: return ""
    if text.startswith('"') and text.endswith('"'):
        text = text[1:-1].strip()
    if ',' in text: return text.split(',')[0].strip()
    else: return text

def to_title_case(value):
    # (Same as previous version - verified working)
    if pd.isna(value): return ""
    return ' '.join(word.capitalize() for word in str(value).split() if word)

# --- Main Processing ---
def process_csv(input_file, output_file):
    tqdm.write(f"Info: Starting processing for '{input_file}'...")

    try:
        tqdm.write("Info: Loading CSV data...")
        df = pd.read_csv(input_file, dtype=str, low_memory=False, keep_default_na=False, na_filter=False)
        original_columns = list(df.columns)
        df.columns = [col.lower() for col in df.columns]

        expected_cols_lower = {col.lower() for col in COLUMN_NAMES}
        found_cols_lower = set(df.columns)
        if expected_cols_lower != found_cols_lower:
             tqdm.write("Error: CSV columns do not match expected headers.")
             # ... (error reporting) ...
             sys.exit(1)

        df = df[[col.lower() for col in COLUMN_NAMES]]
        tqdm.write(f"Info: Initial rows: {len(df)}")

    except FileNotFoundError:
        tqdm.write(f"Error: Input file not found: '{input_file}'"); sys.exit(1)
    except Exception as e:
        tqdm.write(f"Error loading CSV: {e}"); sys.exit(1)

    # --- Filtering ---
    tqdm.write("Info: Applying filters...")
    initial_rows = len(df)

    # 1. Filter by Year
    df[YEAR_COL] = pd.to_numeric(df[YEAR_COL], errors='coerce')
    year_filter_mask = df[YEAR_COL] >= MIN_YEAR
    df = df[year_filter_mask]
    rows_after_year = len(df)
    tqdm.write(f"Info: Rows after year filter ({MIN_YEAR}+): {rows_after_year} (Removed {initial_rows - rows_after_year})")
    initial_rows = rows_after_year

    # 2. Filter by Part Name
    if PART_COL in df.columns and initial_rows > 0:
        exclude_mask = df[PART_COL].str.lower().isin(PARTS_TO_EXCLUDE)
        df = df[~exclude_mask]
        rows_after_part = len(df)
        tqdm.write(f"Info: Rows after part filter: {rows_after_part} (Removed {initial_rows - rows_after_part})")
        initial_rows = rows_after_part
    elif PART_COL not in df.columns:
         tqdm.write(f"Warning: Part column '{PART_COL}' not found for filtering.")

    # 3. Filter by Price (Keep only rows where normalized price is NOT empty)
    if PRICE_COL in df.columns and initial_rows > 0:
        tqdm.write("Info: Applying price filter (removing non-parsable/OOS/NA)...")
        # Calculate normalized price ONCE
        normalized_prices = df[PRICE_COL].apply(normalize_currency)
        # Create mask to KEEP rows where normalized price is NOT empty
        price_filter_mask = normalized_prices != ''
        df = df[price_filter_mask]
        # Store the already normalized prices back to avoid re-calculating later
        # Only assign to the filtered dataframe using .loc to avoid SettingWithCopyWarning
        df.loc[:, PRICE_COL] = normalized_prices[price_filter_mask]

        rows_after_price = len(df)
        tqdm.write(f"Info: Rows after price filter: {rows_after_price} (Removed {initial_rows - rows_after_price})")
        initial_rows = rows_after_price
    elif PRICE_COL not in df.columns:
        tqdm.write(f"Warning: Price column '{PRICE_COL}' not found for filtering.")


    if df.empty:
        tqdm.write("Warning: No rows remaining after filtering.")
    else:
        # --- Cleaning and Normalization ---
        tqdm.write("Info: Applying cleaning and normalization...")

        apply_func = tqdm.pandas if TQDM_AVAILABLE else pd.Series.apply

        if TQDM_AVAILABLE: tqdm.pandas(desc="Title Case Part")
        df[PART_COL] = df[PART_COL].apply(to_title_case)

        # Price column was already normalized during filtering, skip re-applying
        # if TQDM_AVAILABLE: tqdm.pandas(desc="Normalize Price")
        # df[PRICE_COL] = df[PRICE_COL].apply(normalize_currency)

        if TQDM_AVAILABLE: tqdm.pandas(desc="Normalize Core")
        df[CORE_COL] = df[CORE_COL].apply(normalize_currency)

        if TQDM_AVAILABLE: tqdm.pandas(desc="Normalize Total")
        df[TOTAL_COL] = df[TOTAL_COL].apply(normalize_currency)

        if TQDM_AVAILABLE: tqdm.pandas(desc="Extract FullImg URL")
        df[FULLIMG_COL] = df[FULLIMG_COL].apply(extract_first_url)

        if TQDM_AVAILABLE: tqdm.pandas(desc="Extract ThumbImg URL")
        df[THUMBIMG_COL] = df[THUMBIMG_COL].apply(extract_first_url)


    # --- Save Output ---
    tqdm.write(f"Info: Saving {len(df)} processed rows to '{output_file}'...")
    try:
        df.to_csv(output_file, index=False, quoting=csv.QUOTE_MINIMAL)
        tqdm.write("Info: Processing complete.")
    except Exception as e:
        tqdm.write(f"Error saving CSV: {e}"); sys.exit(1)

# --- Script Execution ---
if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(f"Usage: python {sys.argv[0]} <input_csv_file> <output_csv_file>", file=sys.stderr)
        sys.exit(1)
    input_csv = sys.argv[1]
    output_csv = sys.argv[2]
    process_csv(input_csv, output_csv)