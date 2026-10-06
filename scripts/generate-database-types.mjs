import { writeFileSync } from 'node:fs'
import { cli, check, PROJECT_REF } from './supabase-remote-utils.mjs'
const types = cli(['gen', 'types', 'typescript', '--project-id', PROJECT_REF, '--schema', 'public', '--agent', 'no', '--output-format', 'text'])
check(types.includes('export type Database') && types.includes('household_members') && types.includes('cover_position_x'), 'real schema type output')
writeFileSync('src/data/remote/database.types.ts',
  '// Automatically generated from the verified Supabase public schema. Do not edit manually.\n' + types, 'utf8')
console.log('Generated src/data/remote/database.types.ts from the verified project.')
