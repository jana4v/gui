# Portable Yarn Setup

This project is configured to use Yarn Classic for dependency management.

## Copying to Another PC

When copying this project to another PC:

1. **Copy the entire project folder** (including `node_modules` only if you need fully offline startup)
2. **Install dependencies with Yarn** when needed
3. **Run project commands with Yarn**

## Standard Commands

```bash
yarn install
yarn dev
yarn build
yarn test:unit
```

## Notes
- `package.json` is pinned to `yarn@1.22.22`
- Use `yarn.lock` to keep installs reproducible across machines
- If you copy with `node_modules`, startup can be faster on the target PC