import { setArchive } from '../data/archive'
import { testArchive } from './archive'

// Every test file starts with a plan archive in place, as the app does once a
// household has signed in. See ./archive.ts for which one.
setArchive(testArchive())
