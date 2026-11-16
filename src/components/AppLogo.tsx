import Image from "next/image";

type AppLogoProps = {
  size?: number;
  className?: string;
  roundedClassName?: string;
  priority?: boolean;
};

/** Utility Vision app mark (`/icon.png`). */
export function AppLogo({
  size = 48,
  className = "",
  roundedClassName = "rounded-2xl",
  priority = false,
}: AppLogoProps) {
  return (
    <Image
      src="/icon.png"
      alt="Utility Vision"
      width={size}
      height={size}
      className={`${roundedClassName} object-cover ${className}`.trim()}
      priority={priority}
    />
  );
}
