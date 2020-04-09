make setup
make install
make dev

To migrate in development: docker-compose -f docker-compose.development.yml run dev npm run migrate
