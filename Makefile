PROJECT ?= codeapprove-dev

format:
	(cd app && npm run lint-fix) && \
	(cd functions && npm run format)

deploy-firestore:
	firebase --project=$(PROJECT) deploy --only firestore

build-functions:
	(cd functions && npm run build)

deploy-functions: build-functions
	firebase --project=$(PROJECT) deploy --only functions

build-hosting:
	(cd app && npm run build)

deploy-hosting: build-hosting
	firebase --project=$(PROJECT) deploy --only hosting

deploy: deploy-firestore deploy-functions deploy-hosting