import { useState, useEffect } from "react";
import { Plus, X, GripVertical, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useTranslation } from "react-i18next";
import type { FieldOption } from "@shared/schema";

export interface FieldOptionEditorProps {
  title: string;
  description: string;
  options: FieldOption[];
  defaults: FieldOption[];
  settingsKey: string;
  onSave: (key: string, options: FieldOption[]) => void;
  isPending: boolean;
  testIdPrefix: string;
  protectedValues?: string[];
}

export function FieldOptionEditor({
  title,
  description,
  options,
  defaults,
  settingsKey,
  onSave,
  isPending,
  testIdPrefix,
  protectedValues,
}: FieldOptionEditorProps) {
  const protectedSet = new Set(protectedValues || []);
  const { t } = useTranslation();
  const [items, setItems] = useState<FieldOption[]>(options);
  const [newValue, setNewValue] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setItems(options);
    }
  }, [options, isEditing]);

  const hasChanges = JSON.stringify(items) !== JSON.stringify(options);

  const addOption = () => {
    const val = newValue.trim();
    const lbl = newLabel.trim();
    if (!val || !lbl) return;
    if (items.some((i) => i.value === val)) return;
    setItems([...items, { value: val, label: lbl }]);
    setNewValue("");
    setNewLabel("");
  };

  const removeOption = (index: number) => {
    if (protectedSet.has(items[index]?.value)) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const updateLabel = (index: number, label: string) => {
    const updated = [...items];
    updated[index] = { ...updated[index], label };
    setItems(updated);
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...items];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    setItems(updated);
  };

  const moveDown = (index: number) => {
    if (index === items.length - 1) return;
    const updated = [...items];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    setItems(updated);
  };

  const resetToDefaults = () => {
    setItems([...defaults]);
  };

  const handleSave = () => {
    onSave(settingsKey, items);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setItems(options);
    setIsEditing(false);
    setNewValue("");
    setNewLabel("");
  };

  return (
    <Card className="p-5" data-testid={`card-${testIdPrefix}`}>
      <div className="flex items-center justify-between gap-4 mb-1">
        <div>
          <h3 className="text-sm font-medium" data-testid={`text-${testIdPrefix}-title`}>{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
        {!isEditing && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsEditing(true)}
            data-testid={`button-edit-${testIdPrefix}`}
          >
            Edit
          </Button>
        )}
      </div>

      {!isEditing ? (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {items.map((opt) => (
            <span
              key={opt.value}
              className="px-2 py-0.5 text-xs rounded-md bg-muted text-muted-foreground"
              data-testid={`badge-${testIdPrefix}-${opt.value}`}
            >
              {opt.label}
            </span>
          ))}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="space-y-1">
            {items.map((opt, idx) => (
              <div key={opt.value} className="flex items-center gap-2" data-testid={`row-${testIdPrefix}-${opt.value}`}>
                <div className="flex flex-col gap-0.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-4 w-4"
                    onClick={() => moveUp(idx)}
                    disabled={idx === 0}
                    data-testid={`button-move-up-${testIdPrefix}-${opt.value}`}
                  >
                    <GripVertical className="w-3 h-3 rotate-90" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-4 w-4"
                    onClick={() => moveDown(idx)}
                    disabled={idx === items.length - 1}
                    data-testid={`button-move-down-${testIdPrefix}-${opt.value}`}
                  >
                    <GripVertical className="w-3 h-3 rotate-90" />
                  </Button>
                </div>
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded min-w-[80px]">{opt.value}</code>
                <Input
                  value={opt.label}
                  onChange={(e) => updateLabel(idx, e.target.value)}
                  className="h-8 text-sm flex-1"
                  data-testid={`input-label-${testIdPrefix}-${opt.value}`}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => removeOption(idx)}
                  disabled={items.length <= 1 || protectedSet.has(opt.value)}
                  title={protectedSet.has(opt.value) ? "This option is required by the system and cannot be removed" : undefined}
                  data-testid={`button-remove-${testIdPrefix}-${opt.value}`}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-1 border-t">
            <Input
              value={newValue}
              onChange={(e) => setNewValue(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
              placeholder="value_key"
              className="h-8 text-sm w-32"
              data-testid={`input-new-value-${testIdPrefix}`}
            />
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Display Label"
              className="h-8 text-sm flex-1"
              data-testid={`input-new-label-${testIdPrefix}`}
            />
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={addOption}
              disabled={!newValue.trim() || !newLabel.trim()}
              data-testid={`button-add-${testIdPrefix}`}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add
            </Button>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={resetToDefaults}
              className="text-xs"
              data-testid={`button-reset-${testIdPrefix}`}
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Reset to defaults
            </Button>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancel}
                data-testid={`button-cancel-${testIdPrefix}`}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isPending || items.length === 0}
                data-testid={`button-save-${testIdPrefix}`}
              >
                {isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

export interface FieldConfig {
  title: string;
  description: string;
  key: string;
  defaults: FieldOption[];
  current: FieldOption[];
  testId: string;
  protectedValues?: string[];
}

export interface TabConfig {
  value: string;
  label: string;
  fields: FieldConfig[];
}
