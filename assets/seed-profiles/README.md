# Beta Seed Profile Photos

These 12 JPEG files are synthetic photorealistic adult placeholder portraits generated for beta seed profiles. They are fictional people, not photos of real users or stock-photo models.

Use them with:

```bash
cd functions
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
FIREBASE_PROJECT_ID=gym-dating-dev \
FIREBASE_STORAGE_BUCKET=gym-dating-dev.firebasestorage.app \
npx ts-node ../scripts/seedBetaProfiles.ts ../assets/seed-profiles
```

The filenames match `scripts/seedBetaProfiles.config.ts`.
