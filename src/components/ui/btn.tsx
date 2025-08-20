import { cn } from "@/lib/utils"

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "secondary"
  asChild?: boolean
}

export function Btn({ className, variant="primary", ...props }: Props) {
  const base = "inline-flex items-center justify-center h-12 px-5 rounded-2xl text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-lp.sec2"
  const styles = {
    primary:  "bg-lp-primary1 text-lp-primary2 hover:opacity-90 shadow-soft",
    ghost:    "border border-lp-primary1/25 text-lp-primary1 hover:bg-lp-primary1/5",
    secondary:"bg-lp-sec3 text-white hover:opacity-95 shadow-soft"
  } as const
  return <button className={cn(base, styles[variant], className)} {...props} />
}
