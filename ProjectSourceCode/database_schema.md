# Car Parts Application UML Diagram

```mermaid
classDiagram
User "1" -- "0..*" Vehicle : owns
User "1" -- "0..*" Order : places
User "1" -- "0..*" Address : has
Vehicle "1" -- "0..*" Repair : has
Part "1" -- "0..*" PartCompatibility : has
Part "1" -- "0..*" Pricing : has
Part "1" -- "0..*" OrderItem : included in
Part "1" -- "0..*" Repair : used in
PartCompatibility -- Part
Vendor "1" -- "0..*" Pricing : offers
Order "1" -- "0..*" OrderItem : contains
Order "1" -- "1" Vehicle : for
Order "1" -- "1" Address : ships to

class User {
    +user_id
    +username
    +first_name
    +last_name
    +email
    +password_hash
    +name
}

class Address {
    +id
    +user_id
    +street_address
    +city
    +state
    +postal_code
    +country
    +is_default
}

class Vehicle {
    +vehicle_id
    +user_id
    +make
    +model
    +year
}

class Part {
    +part_id
    +name
    +description
    +category
}

class PartCompatibility {
    +compatibility_id
    +part_id
    +make
    +model
    +year_start
    +year_end
}

class Vendor {
    +vendor_id
    +name
    +website
}

class Pricing {
    +pricing_id
    +part_id
    +vendor_id
    +price
    +shipping
    +url
}

class Order {
    +order_id
    +user_id
    +vehicle_id
    +order_date
    +status
}

class OrderItem {
    +item_id
    +order_id
    +part_id
    +quantity
    +price
}

class Repair {
    +repair_id
    +vehicle_id
    +part_id
    +repair_date
    +notes
}