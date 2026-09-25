import logo from "./assets/typesafe-logo.png";

// Official TypeSafe site icon, retrieved 2026-09-25 from typesafe.ai's rel=icon.
// Source: https://framerusercontent.com/images/aNFzSFxM4fjICmnibw7npfZjcQ.png
export function TypeSafeLogo({ size = 20 }: { size?: number }) {
  return <img src={logo} alt="TypeSafe — JEV" title="JEV by TypeSafe" width={size} height={size}
    style={{ display: "inline-block", objectFit: "contain", flexShrink: 0, verticalAlign: "middle" }} />;
}
