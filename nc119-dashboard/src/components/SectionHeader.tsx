interface SectionHeaderProps {
  id: string;
  title: string;
  subtitle?: string;
}

export const SectionHeader = ({ id, title, subtitle }: SectionHeaderProps) => {
  return (
    <header id={id} className="scroll-mt-24">
      <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
        {title}
      </h2>
      {subtitle ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{subtitle}</p> : null}
    </header>
  );
};
