declare module 'solc' {
    export function compile(input: string): string
    export function loadRemoteVersion(
        version: string,
        callback: (error: Error, solc: Solc) => void
    ): void
    export interface Solc {
        compile(input: string): string
    }
}
