# UAT Test Plan
A document that describes how three features in the application will be tested. This plan will be executed on week 4.

## Environment
Platform: Web application running on Docker containers.

Environment: Local development environment.

Browser: Chrome

Database: PostgreSQL in Docker container

CI/CD: Setup to automatically perform tests with Github Actions.

## User Acceptance Testers
Internal Team Members: Rey, Eva, Nanda, Sabir (representing developer perspective)

External Testers: 2-3 non-technical users with automotive knowledge

Testing Coordinator: Sami-ul (responsible for documenting test results)

## Feature 1: Adding Cars to Profile
- User should be able to add cars to their profile.
- User must fill out all fields of car details before submitting a new vehicle.
- User should receive detailed feedback on submission errors.
- Added vehicle data should be persistent across multiple user sessions.

Acceptance Criteria

- A user cannot submit a vehicle without mandatory fields, including:
    - Make
    - Model
    - Year
    - Engine type
- Entered vehicle data should be stored in the database and associated with the user by foreign key.
- User should be able to see their vehicle displayed in their profile after successful submission.
- Users should be able to add multiple vehicles to their profile.

Test Data

Valid Data Set: 
- Make: "Toyota", Model: "Camry", Year: "2018", Engine: "2.5L 4-cylinder"
- Make: "Honda", Model: "Civic", Year: "2020", Engine: "2.5L 4-cylinder"

Invalid Data Set:
- Missing make: "", Model: "Accord", Year: "2019", Engine: "2.5L 4-cylinder"
- Invalid year: Make: "Toyota", Model: "Corolla", Year: "202x", Engine: "2.5L 4-cylinder"

Test Cases

Positive
1. Login with valid user credentials
2. Navigate to the "My Cars" section
3. Click "Add New Vehicle" button
4. Enter Make: "Toyota"
5. Enter Model: "Camry"
6. Enter Year: "2018", enter Engine: "2.5L 4-cylinder"
7. Click "Save"
8. Expected Result: Vehicle is added to the profile, user is redirected to their vehicles list, which includes the newly added vehicle

Negative
1. Login with valid user credentials
2. Navigate to the "My Cars" section
3. Click "Add New Vehicle" button
4. Enter Make: ""
5. Enter Model: "Accord"
6. Enter Year: "2019", enter Engine: "2.5L 4-cylinder"
7. Click "Save"
8. Expected Result: Form submission is prevented, error message indicates make is required

## Feature 2: Search for Car Parts
- Users must be able to search for parts compatible with their vehicles
- The system must display parts matching the search criteria
- Users must be able to view detailed part information and pricing from at least one vendor
- Parts should be pulled from ecommerce websites like Ebay and Amazon if development time permits, otherwise just from RockAutoParts.

Acceptance Criteria

- Search form must allow selection of make, model, year, and engine type
- Search form must allow cars from your profile to be autofilled.
- Search results must only show compatible parts
- Search results must include part name, description, and pricing information
- Users must be able to sort and filter search results
- Users must be able to add parts to their cart directly from search results

Test Data

- Vehicle Data: Toyota Camry 2018
- Parts Data: Oil filters, brake pads compatible with test vehicle
- Vendor Data: Amazon, Advance Auto Parts with different pricing

Test Cases

Search for parts

1. Search for parts using complete vehicle information
2. Navigate to the discover page
3. Search for "filter"
4. Expected Result: Search results display all parts with filter in title or description

Failed parts search

1. Search for parts using incomplete information
2. Enter an empty query
3. Expected Result: The user should be redirected to discover.

Add a part to cart from search results

1. Perform a successful parts search.
2. For the first oil filter result, click "Add to Cart"
3. Expected Result: Part is added to the user's cart, verify from cart.

## Feature 3: Shipping Options (Ship to Home / Ship to Nearby Installation Shop)
- After selecting parts and proceeding to checkout, users should be able to choose a shipping option.
- Users must be able to either:
    - Ship parts to their home
    - Ship parts to a nearby verified installation shop

- If the user chooses "Ship to shop", the system should verify the installation shop and display available locations.
- If "Ship to home" is selected, installation videos should be recommended.
- The system should allow users to enter or select an address/shop before proceeding.

Acceptance Criteria

- User must select one shipping method before making payment.
- If "Ship to shop" is selected:
    - System must validate and list nearby installation shops.
    - The installation shop must be verified before order confirmation.
- If "Ship to home" is selected:
    - System should prompt or recommend installation videos after checkout.
    - User must not be able to proceed without providing a valid shipping address or shop selection.

Test Data

Valid Input:
- Home Address: 123 Main St, Denver, CO 80202
- Installation Shop: "QuickFit Garage", verified, 2 miles away

Invalid Input:
- No address provided
- Unverified installation shop selected

Test Cases

Ship to Nearby Installation Shop

1. Login and add a compatible part to cart.
2. Proceed to checkout.
3. Choose "Ship to installation shop".
4. Select "QuickFit Garage" (verified shop).
5. Click "Continue".
6. Expected Result: System verifies the shop and allows user to proceed to payment.

Ship to Home with Installation Videos Prompt

1. Login and add a part to cart.
2. Proceed to checkout.
3. Choose "Ship to home".
4. Enter Home Address: 123 Main St, Denver, CO 80202
5. Complete payment.
6. Expected Result: Order is placed, confirmation screen appears, and installation videos are suggested.

Invalid Shipping (No Address or Shop)

1. Login and add item to cart.
2. Proceed to checkout.
3. Select "Ship to home" but leave address field blank.
4. Try to continue.
5. Expected Result: User cannot proceed, and error message prompts for address input.