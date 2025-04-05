# Vehicle Data Schema

```mermaid
classDiagram
Make -- Year
Year -- Model
Model -- Engine

class Make {
    + make_id
    + make
}
class Year {
    + year_id
    + make_id
    + year 
}
class Model {
    + model_id
    + year_id
    + model
}
class Engine {
    + engine_id
    + model_id
    + engine
}
```