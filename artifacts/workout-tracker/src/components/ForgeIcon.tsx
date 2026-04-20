interface Props {
  className?: string;
}

export function ForgeIcon({ className }: Props) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Dumbbell left plate */}
      <rect x="11" y="12" width="11" height="23" rx="2.5" />
      {/* Dumbbell handle */}
      <rect x="20" y="20" width="24" height="7" rx="3" />
      {/* Dumbbell right plate */}
      <rect x="42" y="12" width="11" height="23" rx="2.5" />

      {/* Anvil top face — sits flush under the dumbbell */}
      <rect x="17" y="25" width="32" height="10" rx="1.5" />
      {/* Anvil horn — right-pointing, merges with right plate */}
      <path d="M49 25 L49 35 L61 30 Z" />
      {/* Anvil waist */}
      <rect x="22" y="35" width="22" height="7" rx="1" />
      {/* Anvil base */}
      <rect x="14" y="42" width="36" height="11" rx="2.5" />
    </svg>
  );
}
