import { register } from 'node:module'

register(new URL('./dsh-fake-hooks.js', import.meta.url))
