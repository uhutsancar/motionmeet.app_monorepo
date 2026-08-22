# Brand assets

`motionmeet-mark.svg` is the MotionMeet mark: two athletes reaching toward each
other over a shared pulse, whose silhouette reads as an M. `motionmeet-glyph.svg`
is the same drawing without the rounded tile behind it, for places that mask or
recolour the background themselves.

These two files are the only source. Everything else the apps ship — the Android
launcher and adaptive icons, the splash plate, the browser favicons, the
apple-touch icon and the web logo — is rendered from them:

```bash
pnpm brand
```

The React Native component `packages/mobile/src/components/MotionMark.tsx`
redraws the same geometry with `react-native-svg`, because a vector in the app
header stays crisp where a PNG would not. Its paths must be kept in step with
`motionmeet-mark.svg` by hand; there is only ever one mark.
