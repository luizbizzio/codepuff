// The values the CodePuff mod keeps in the host's `$.state`. Only a redraw counter: everything that
// matters (the pet, the statistics) is stored in CodePuff's own data folder, never in host state.
export type CodePuffRevision = number

declare module 'claude-code' {
  interface PluginState {
    codepuff: { rev: CodePuffRevision }
  }
}
