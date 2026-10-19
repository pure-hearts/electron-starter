# Typed IPC

All system APIs are centralized in `src/shared/ipc.ts`. Runtime values are checked in `src/shared/validation.ts` and main sender origin is checked in `src/main/ipc.ts`.

```ts
await window.desktop.invoke('store:set', 'theme', 'dark')
const current = await window.desktop.invoke('store:get', 'theme')

const stop = window.desktop.on('download:state', state => {
  console.log(state.percent)
})
stop()
```

To add a method: extend `DesktopInvoke`, add a channel in `allowedChannels`, validate parameters in `validate()`, then add handler in `src/main/ipc.ts`.

No generic `send arbitrary IPC`, arbitrary file read/write or shell execution is exposed.
