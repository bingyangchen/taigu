import { asIcon } from "./IconLayout";

function IconPause() {
  return (
    <>
      <rect x="5" y="4" width="5" height="16" rx="1.5" />
      <rect x="14" y="4" width="5" height="16" rx="1.5" />
    </>
  );
}

export default asIcon(IconPause);
