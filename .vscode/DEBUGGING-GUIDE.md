# Next.js Server Actions Debugging Guide

## Turbopack vs Webpack Issues

Your project is set up to use Turbopack by default (`npm run dev`), but this can cause issues with server actions debugging. If you're experiencing issues with server actions or debugging breakpoints, follow these steps:

## How to Debug Server Actions

1. **Use Webpack Instead of Turbopack**:
   ```bash
   npm run dev-wp  # Uses webpack instead of turbopack
   # OR
   npm run dev:debug:win  # On Windows
   npm run dev:debug:unix  # On Mac/Linux
   ```

2. **In VS Code**:
   - Set breakpoints in your server action files (e.g., `auto-agent-next.ts`)
   - Press F5 or click the Run/Debug icon in the sidebar
   - Select "Next.js: Server-side Debugging" configuration
   
3. **Check Your Breakpoint Status**:
   - Solid red circle: Breakpoint is active and will trigger
   - Hollow red circle: Breakpoint location is valid but not yet bound
   - Gray hollow circle with an X: Breakpoint location couldn't be mapped

## Troubleshooting

### If Breakpoints Aren't Hitting:

1. Make sure you're using the Webpack version of the dev server (`npm run dev-wp`)
2. Restart VS Code and the development server
3. Delete the `.next` folder and restart the server:
   ```
   # On Windows PowerShell
   rmdir -r -force .next
   
   # On Mac/Linux
   rm -rf .next
   ```
4. Ensure the Next.js server is actually running in debug mode

### Server Action Error: "Failed to find Server Action"

This can occur due to:
- **Encryption key issues**: Your project now uses a fixed encryption key in `.env.local`
- **Caching issues**: Try clearing the `.next` folder and browser cache
- **Turbopack issues**: Switch to webpack with `npm run dev-wp`

## Advanced Tips

- The `.vscode/launch.json` now includes specific configurations for debugging with both Webpack and Turbopack
- Server actions defined with `"use server"` are compiled differently than regular code
- When debugging, watch both the VS Code Debug Console AND your terminal running the Next.js server for complete logs

## For Specific Context Issues ("newContext" array)

If you're having issues with the context array not properly updating between server and client:
1. Add `console.log` statements before and after modifications
2. Check if the problematic code is in a different server action that might be called
3. Try using a simpler data structure for testing (objects with only primitive values) 