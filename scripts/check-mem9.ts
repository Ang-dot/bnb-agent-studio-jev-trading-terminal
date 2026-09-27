import { Mem9Memory } from '../server/mem9.js';

// This command only reads the configured application scope. It does not start
// discovery, run JEV, provision a Space, or upload local files/history.
if (!process.env.MEM9_API_KEY?.trim()) {
  console.error('MEM9_API_KEY is missing. Add a Space API key to the backend environment.');
  process.exitCode = 1;
} else {
  try {
    await new Mem9Memory(process.env).verify();
    console.log('MEM9 Space access confirmed. No memories were written.');
  } catch {
    console.error('MEM9 access could not be confirmed. Check the Space key, API origin and network connection.');
    process.exitCode = 1;
  }
}
