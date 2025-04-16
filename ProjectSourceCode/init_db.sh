#!/bin/bash

# DO NOT PUSH THIS FILE TO GITHUB
# This file contains sensitive information and should be kept private

# TODO: Set your PostgreSQL URI - Use the External Database URL from the Render dashboard
PG_URI="postgresql://users_db_3308_user:YBvEKg1qDs5YOzyZ88xctqujKtMZ63f1@dpg-cvvuj649c44c73fai9cg-a.virginia-postgres.render.com/users_db_3308"

# Execute each .sql file in the directory
for file in init_data/*.sql; do
    echo "Executing $file..."
    psql $PG_URI -f "$file"
done