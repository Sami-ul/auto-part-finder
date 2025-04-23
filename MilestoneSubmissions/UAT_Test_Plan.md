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
3. Select Make: "Toyota" from dropdown
4. Select Model: "Camry" from dropdown
5. Select Year: "2018" from dropdown
6. Select Engine: "2.5L 4-cylinder" from dropdown
7. Click "Search" button
8. Expected Result: Search results display parts compatible with the selected vehicle, including oil filters and brake pads with pricing from multiple vendors

Failed parts search

1. Search for parts using incomplete vehicle information
2. Navigate to the discover page
3. Select Make: Do not select a make from dropdown
4. Expected Result: The user should not be able to select a model or press the search button.

Add a part to cart from search results

1. Perform a successful parts search.
2. For the first oil filter result, click "Add to Cart"
3. Expected Result: Part is added to the user's cart, cart count in the navigation is updated, user receives a confirmation message

## Feature 3: Checkout Flow
- Users must be able to add parts to their cart
- Users must be able to review items in their cart
- Users must be able to select a shipping address during checkout
- Users must be able to complete payment and place an order

Acceptance Criteria

- User can add and remove parts from their cart
- User can proceed to checkout from the cart page
- User can select from their saved addresses for shipping
- User must provide a valid shipping address before completing payment
- User can complete payment via Stripe
- User receives order confirmation after successful payment

Test Data

Valid Input:
- Shipping Address: User's default address or any saved address
- Payment: Valid test credit card information (Stripe test card)

Invalid Input:
- No address provided
- No payment info provided

Test Cases

Basic Checkout Flow

1. Login with valid user credentials
2. Search for and add a compatible part to cart
3. Navigate to the cart page
4. Verify the correct part appears in the cart
5. Click "Proceed to Checkout"
6. Select an existing shipping address or enter a new one
7. Complete payment with Stripe test card
8. Expected Result: Order is placed successfully, cart is emptied, and confirmation is shown


Invalid Checkout (No Address)
1. Login and add item to cart
2. Proceed to checkout
3. Attempt to complete checkout without selecting an address
4. Expected Result: User cannot proceed, error message prompts for address selection

Invalid Checkout (Payment Failure)
1. Login and add item to cart
2. Proceed to checkout
3. Select a valid shipping address
4. Enter invalid payment information
5. Expected Result: Payment is rejected, user is prompted to correct payment information