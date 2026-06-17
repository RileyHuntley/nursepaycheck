import ShiftForm from '@/components/payroll/ShiftForm';
import { Dialog, DialogContent } from '@/components/ui/dialog';

export default function EditShiftDialog({ editingShift, settings, onSubmit, onClose, onDelete }) {
  if (!editingShift) return null;

  return (
    <Dialog open={!!editingShift} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto [&>button:last-child]:hidden">
        <ShiftForm
          initial={editingShift.data}
          onSubmit={onSubmit}
          onCancel={onClose}
          onDelete={editingShift.isDuplicate ? null : onDelete}
          isDuplicate={editingShift.isDuplicate || false}
          settings={settings}
        />
      </DialogContent>
    </Dialog>
  );
}