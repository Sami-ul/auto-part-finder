// To add vehicle to profile and database
app.post('/api/vehicles', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { year, make, model, engine } = req.body;

  // Add validation
  if (!year || !make || !model || !engine) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  console.log('Attempting to add vehicle:', {
    user_id: req.session.user.id,
    make,
    model,
    year,
    engine
  });

  db.oneOrNone(
    'SELECT * FROM vehicles WHERE make = $1 AND model = $2 AND year = $3 AND engine = $4',
    [make, model, year, engine]
  )
    .then(foundVehicle => {
      if (foundVehicle) {
        db.one(
          'INSERT INTO user_owned_vehicles(user_id, vehicle_id) VALUES($1, $2) RETURNING id',
          [req.session.user.id, foundVehicle.id]
        )
          .then(data => {
            console.log('Successfully added vehicle:', data);
            res.json({
              success: true,
              id: data.id,
              vehicle: { id: data.id, year, make, model, engine }
            });
          })
          .catch(error => {
            console.error('Database error:', error);
            res.status(500).json({ error: 'Failed to add vehicle', details: error.message });
          });
      }
      else {
        res.status(500).json({ error: 'Failed to add vehicle', details: "Unable to find vehicle in database" });
      }
    })
    .catch(error => {
      console.error('Database error:', error);
      res.status(500).json({ error: 'Failed to add vehicle', details: error.message });
    });
});

// To edit vehicle on profile and database
app.put('/api/vehicles/:id', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { year, make, model, engine } = req.body;

  db.oneOrNone(
    'SELECT * FROM vehicles WHERE make = $1 AND model = $2 AND year = $3 AND engine = $4',
    [make, model, year, engine]
  )
    .then(foundVehicle => {
      if (foundVehicle) {
        db.none(
          'UPDATE user_owned_vehicles SET vehicle_id = $1 WHERE id = $2 AND user_id = $3',
          [foundVehicle.id, req.params.id, req.session.user.id]
        )
          .then(() => {
            res.json({ 
              success: true,
              vehicle: { id: parseInt(req.params.id), year, make, model, engine }
            });
          })
          .catch(error => {
            console.error('Error updating vehicle association:', error);
            res.status(500).json({ error: 'Failed to update vehicle association' });
          });
      } else {
        res.status(404).json({ error: 'Vehicle not found in database' });
      }
    })
    .catch(error => {
      console.error('Database error:', error);
      res.status(500).json({ error: 'Failed to update vehicle', details: error.message });
    });
});