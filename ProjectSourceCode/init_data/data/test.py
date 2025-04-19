import csv
import json
from collections import defaultdict

def transform_csv(input_file, output_file):
    # Dictionary to store part information with compatible vehicles
    parts_dict = defaultdict(lambda: {
        'vehicles': [],
        'data': {}  # Will store all other part data
    })
    
    # Read the input CSV
    with open(input_file, 'r', newline='', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)
        
        # Process each row
        for row in reader:
            # Create a unique key for each part
            part_key = f"{row['part']}_{row['brand']}_{row['partnumber']}"
            
            # Store all part data (excluding vehicle-specific fields)
            if not parts_dict[part_key]['data']:
                parts_dict[part_key]['data'] = {
                    'part': row['part'],
                    'brand': row['brand'],
                    'partnumber': row['partnumber'],
                    'description': row['description'],
                    'price': row['price'],
                    'core': row['core'],
                    'pack': row['pack'],
                    'total': row['total'],
                    'fits': row['fits'],
                    'fullimg': row['fullimg'],
                    'thumbimg': row['thumbimg']
                }
            
            # Add vehicle information
            vehicle_info = {
                'make': row['make'],
                'model': row['model'],
                'year': row['year'],
                'engine': row['engine']
            }
            
            # Add to the vehicles list if not already present
            if vehicle_info not in parts_dict[part_key]['vehicles']:
                parts_dict[part_key]['vehicles'].append(vehicle_info)
    
    # Prepare the new CSV structure
    fieldnames = [
        'part', 'brand', 'partnumber', 'description', 'price', 'core', 
        'pack', 'total', 'fits', 'fullimg', 'thumbimg', 'compatible_vehicles'
    ]
    
    # Write to the output CSV
    with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        
        # Write each part with its compatible vehicles
        for part_key, part_data in parts_dict.items():
            row_data = part_data['data'].copy()
            
            # Format compatible vehicles as JSON string
            row_data['compatible_vehicles'] = json.dumps(part_data['vehicles'])
            
            writer.writerow(row_data)
    
    print(f"Transformation complete. Output written to {output_file}")
    
    # Print some stats
    print(f"Total unique parts: {len(parts_dict)}")
    
    # List a few examples
    print("\nSample entries:")
    for idx, (part_key, part_data) in enumerate(list(parts_dict.items())[:3]):
        print(f"Part {idx+1}: {part_data['data']['part']} - {part_data['data']['brand']} - {part_data['data']['partnumber']}")
        print(f"Compatible with {len(part_data['vehicles'])} vehicles")

# Usage
if __name__ == "__main__":
    transform_csv("vehicle_data.csv", "parts_with_compatibility.csv")