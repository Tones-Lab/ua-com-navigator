type ProcessorTooltip = {
  title: string;
  description: string;
  example: string;
  x: number;
  y: number;
};

type FcomProcessorTooltipProps = {
  tooltip: ProcessorTooltip | null;
};

export default function FcomProcessorTooltip({ tooltip }: FcomProcessorTooltipProps) {
  if (!tooltip) {
    return null;
  }

  return (
    <div
      className="floating-help-tooltip"
      style={{ left: tooltip.x, top: tooltip.y }}
      role="tooltip"
    >
      <div className="floating-help-title">{tooltip.title}</div>
      <div className="floating-help-text">{tooltip.description}</div>
      <div className="floating-help-code">{tooltip.example}</div>
    </div>
  );
}
