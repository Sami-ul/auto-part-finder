# UAT Test Plan
A document that describes how three features in the application will be tested. This plan will be executed on week 4.

## Environment
Platform: Web application running on Docker containers.
Environment: Local development environment.
Browser: Chrome
Database: PostgreSQL in Docker container
CI/CD: Setup to automatically perform tests with Github Actions.

## User Acceptance Testers
Internal Team Members: Rey, Eva, Nanda (representing developer perspective)
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
- Entered vehicle data should be stored in the database and associated with the user by foreign key.
- User should be able to see their vehicle displayed in their profile after successful submission.
- Users should be able to add multiple vehicles to their profile.

Test Data

Valid Data Set: 
- Make: "Toyota", Model: "Camry", Year: "2018"
- Make: "Honda", Model: "Civic", Year: "2020"

Invalid Data Set:
- Missing make: "", Model: "Accord", Year: "2019"
- Invalid year: Make: "Toyota", Model: "Corolla", Year: "202x"

Test Cases

Positive
1. Login with valid user credentials
2. Navigate to the "My Cars" section
3. Click "Add New Vehicle" button
4. Enter Make: "Toyota"
5. Enter Model: "Camry"
6. Enter Year: "2018"
7. Click "Save"
8. Expected Result: Vehicle is added to the profile, user is redirected to their vehicles list, which includes the newly added vehicle

Negative
1. Login with valid user credentials
2. Navigate to the "My Cars" section
3. Click "Add New Vehicle" button
4. Enter Make: ""
5. Enter Model: "Accord"
6. Enter Year: "2019"
7. Click "Save"
8. Expected Result: Form submission is prevented, error message indicates make is required
