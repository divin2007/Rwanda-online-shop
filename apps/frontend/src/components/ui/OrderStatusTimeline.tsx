import { useLanguage } from '@/context/LanguageContext';

const STEPS = ['placed', 'confirmed', 'picked_up', 'in_transit', 'delivered'];

export const OrderStatusTimeline = ({ currentStatus }: { currentStatus: string }) => {
  const { t } = useLanguage();
  const normalizeStatus = (s: string) => {
    if (['resolved', 'completed', 'closed'].includes(s)) return 'delivered';
    if (['preparing', 'ready_for_pickup'].includes(s)) return 'confirmed';
    if (['awaiting_confirmation'].includes(s)) return 'in_transit';
    return s;
  };
  const currentIndex = STEPS.indexOf(normalizeStatus(currentStatus));

  return (
    <div className="w-full py-6">
      <div className="flex items-center justify-between relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-border z-0"></div>
        <div 
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary z-0 transition-all duration-500"
          style={{ width: `${(Math.max(0, currentIndex) / (STEPS.length - 1)) * 100}%` }}
        ></div>
        
        {STEPS.map((step, index) => {
          const isCompleted = index <= currentIndex;
          const isCurrent = index === currentIndex;
          
          return (
            <div key={step} className="relative z-10 flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${
                isCurrent ? 'bg-primary text-secondary border-4 border-background-card ring-2 ring-primary' :
                isCompleted ? 'bg-primary text-secondary' : 'bg-background-card border-2 border-border text-text-muted'
              }`}>
                {isCompleted ? '✓' : index + 1}
              </div>
              <span className={`absolute top-10 text-xs font-bold whitespace-nowrap ${
                isCompleted ? 'text-text-primary' : 'text-text-muted'
              }`}>
                {t(`status_${step}` as any)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
