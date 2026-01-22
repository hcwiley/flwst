# Configuration Examples

This directory contains example configuration files with placeholder values.

## Files

- `.env.example` - Local development environment variables
- `firebase.functions.env.example` - Firebase Functions environment variables template

## Setup Instructions

### Local Development

1. Copy `.env.example` to `config/.env`:

   ```bash
   cp config/examples/.env.example config/.env
   ```

2. Edit `config/.env` and fill in your actual values
3. Never commit `config/.env` to git (it's in `.gitignore`)

### Firebase Functions

Firebase Functions environment variables are set in the Firebase Console, not in files.

1. Go to Firebase Console > Functions > Configuration
2. Add the variables listed in `firebase.functions.env.example`
3. See `servers/firebase/README.md` for detailed setup instructions

## Where Secrets Live

- **Local development**: `config/.env` (not committed)
- **Firebase Functions**: Firebase Console > Functions > Configuration
- **Notion OAuth**: Stored in encrypted local storage (see Phase 2)
- **Firebase API keys**: Firebase Console environment variables

## Security Notes

- All example files use placeholder values only
- Never commit real credentials to git
- Use environment variables for all secrets
- Encrypt sensitive local data (see Phase 2 implementation)
