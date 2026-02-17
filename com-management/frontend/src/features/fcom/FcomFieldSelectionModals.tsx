import EmptyState from '../../components/EmptyState';
import Modal from '../../components/Modal';

type AddFieldContext = {
  panelKey: string;
  obj: unknown;
} | null;

type FcomFieldSelectionModalsProps = {
  showAddFieldModal: boolean;
  addFieldContext: AddFieldContext;
  addFieldSearch: string;
  setAddFieldSearch: (value: string) => void;
  availableEventFields: string[];
  panelAddedFields: Record<string, string[]>;
  reservedEventFields: Set<string>;
  getEventFieldDescription: (field: string) => string;
  addFieldToPanel: (field: string) => void;
  onCloseAddField: () => void;
  eventFieldPickerOpen: boolean;
  eventFieldSearch: string;
  setEventFieldSearch: (value: string) => void;
  handleEventFieldInsertSelect: (field: string) => void;
  onCloseEventFieldPicker: () => void;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export default function FcomFieldSelectionModals({
  showAddFieldModal,
  addFieldContext,
  addFieldSearch,
  setAddFieldSearch,
  availableEventFields,
  panelAddedFields,
  reservedEventFields,
  getEventFieldDescription,
  addFieldToPanel,
  onCloseAddField,
  eventFieldPickerOpen,
  eventFieldSearch,
  setEventFieldSearch,
  handleEventFieldInsertSelect,
  onCloseEventFieldPicker,
}: FcomFieldSelectionModalsProps) {
  return (
    <>
      {showAddFieldModal && addFieldContext && (
        <Modal className="modal-wide" ariaLabel="Add Event Field">
          <h3>Add Event Field</h3>
          <p>Select a field from this file, or add a new one.</p>
          <input
            type="text"
            placeholder="Search fields"
            value={addFieldSearch}
            onChange={(e) => setAddFieldSearch(e.target.value)}
          />
          <div className="add-field-list">
            {availableEventFields
              .filter((field) => field.toLowerCase().includes(addFieldSearch.toLowerCase()))
              .map((field) => {
                const contextObj = isRecord(addFieldContext.obj) ? addFieldContext.obj : null;
                const contextEvent =
                  contextObj && isRecord(contextObj.event) ? contextObj.event : {};
                const existingFields = new Set([
                  ...Object.keys(contextEvent),
                  ...(panelAddedFields[addFieldContext.panelKey] || []),
                ]);
                const isReserved = reservedEventFields.has(field);
                const isExisting = existingFields.has(field);
                const description = getEventFieldDescription(field);
                const titleParts = [
                  ...(isReserved ? ['Reserved field'] : []),
                  ...(isExisting ? ['Already present'] : []),
                  ...(description ? [description] : []),
                ];
                return (
                  <button
                    key={field}
                    type="button"
                    className={
                      isReserved || isExisting
                        ? 'add-field-item add-field-item-disabled'
                        : 'add-field-item'
                    }
                    onClick={() => {
                      if (!isReserved && !isExisting) {
                        addFieldToPanel(field);
                      }
                    }}
                    disabled={isReserved || isExisting}
                    title={titleParts.join(' • ')}
                  >
                    {field}
                  </button>
                );
              })}
            {availableEventFields.length === 0 && (
              <EmptyState>No event fields found in this file.</EmptyState>
            )}
            {addFieldSearch.trim() &&
              !availableEventFields.some(
                (field) => field.toLowerCase() === addFieldSearch.trim().toLowerCase(),
              ) && (
                <button
                  type="button"
                  className="add-field-item"
                  onClick={() => addFieldToPanel(addFieldSearch.trim())}
                >
                  Add "{addFieldSearch.trim()}"
                </button>
              )}
          </div>
          <div className="modal-actions">
            <button type="button" onClick={onCloseAddField}>
              Close
            </button>
          </div>
        </Modal>
      )}

      {eventFieldPickerOpen && (
        <Modal className="modal-wide" ariaLabel="Event Fields">
          <h3>Event Fields</h3>
          <input
            type="text"
            placeholder="Search event fields"
            value={eventFieldSearch}
            onChange={(e) => setEventFieldSearch(e.target.value)}
          />
          <div className="add-field-list">
            {availableEventFields
              .filter((field) => field.toLowerCase().includes(eventFieldSearch.trim().toLowerCase()))
              .map((field) => (
                <button
                  type="button"
                  key={field}
                  className="add-field-item"
                  onClick={() => handleEventFieldInsertSelect(field)}
                  title={getEventFieldDescription(field)}
                >
                  $.event.{field}
                </button>
              ))}
            {availableEventFields.length === 0 && (
              <EmptyState>No event fields found in this file.</EmptyState>
            )}
            {eventFieldSearch.trim() &&
              !availableEventFields.some(
                (field) => field.toLowerCase() === eventFieldSearch.trim().toLowerCase(),
              ) && (
                <button
                  type="button"
                  className="add-field-item"
                  onClick={() => handleEventFieldInsertSelect(eventFieldSearch.trim())}
                >
                  Add "{eventFieldSearch.trim()}"
                </button>
              )}
          </div>
          <div className="modal-actions">
            <button type="button" onClick={onCloseEventFieldPicker}>
              Close
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
