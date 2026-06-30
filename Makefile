dev-db:
	docker compose up db -d --wait

dev-backend:
	cd backend && NODE_ENV=development npm run dev

dev-frontend:
	cd frontend && npm run dev

test:
	cd backend && npm test
	cd frontend && npm test

build:
	cd backend && npm run build
	cd frontend && npm run build

docker-up:
	docker compose up --build -d --wait

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f
