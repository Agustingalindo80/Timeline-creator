import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface DateRangeFilterProps {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
}

export function DateRangeFilter({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
}: DateRangeFilterProps) {
  return (
    <div className="flex items-end gap-2 flex-wrap">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">From</Label>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="w-40"
          data-testid="input-filter-date-from"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">To</Label>
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
          className="w-40"
          data-testid="input-filter-date-to"
        />
      </div>
    </div>
  );
}

interface DropdownFilterProps {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  testId?: string;
}

export function DropdownFilter({
  label,
  value,
  onValueChange,
  options,
  placeholder = "All",
  testId,
}: DropdownFilterProps) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="w-44" data-testid={testId || `select-filter-${label.toLowerCase().replace(/\s+/g, "-")}`}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{placeholder}</SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

interface HealthFilterProps {
  value: string;
  onValueChange: (value: string) => void;
}

export function HealthFilter({ value, onValueChange }: HealthFilterProps) {
  return (
    <DropdownFilter
      label="Health"
      value={value}
      onValueChange={onValueChange}
      options={[
        { value: "green", label: "Green" },
        { value: "amber", label: "Amber" },
        { value: "red", label: "Red" },
      ]}
      placeholder="All Health"
      testId="select-filter-health"
    />
  );
}

interface ProjectFilterProps {
  value: string;
  onValueChange: (value: string) => void;
  projects: { id: string; name: string }[];
}

export function ProjectFilter({
  value,
  onValueChange,
  projects,
}: ProjectFilterProps) {
  return (
    <DropdownFilter
      label="Project"
      value={value}
      onValueChange={onValueChange}
      options={projects.map((p) => ({ value: p.id, label: p.name }))}
      placeholder="All Projects"
      testId="select-filter-project"
    />
  );
}

interface ClientFilterProps {
  value: string;
  onValueChange: (value: string) => void;
  clients: { id: string; name: string }[];
}

export function ClientFilter({
  value,
  onValueChange,
  clients,
}: ClientFilterProps) {
  return (
    <DropdownFilter
      label="Client"
      value={value}
      onValueChange={onValueChange}
      options={clients.map((c) => ({ value: c.id, label: c.name }))}
      placeholder="All Clients"
      testId="select-filter-client"
    />
  );
}

interface RegionFilterProps {
  value: string;
  onValueChange: (value: string) => void;
  regions: string[];
}

export function RegionFilter({
  value,
  onValueChange,
  regions,
}: RegionFilterProps) {
  return (
    <DropdownFilter
      label="Region"
      value={value}
      onValueChange={onValueChange}
      options={regions.map((r) => ({ value: r, label: r }))}
      placeholder="All Regions"
      testId="select-filter-region"
    />
  );
}

interface ToggleFilterProps {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  testId?: string;
}

export function ToggleFilter({
  label,
  checked,
  onCheckedChange,
  testId,
}: ToggleFilterProps) {
  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        data-testid={testId || `switch-filter-${label.toLowerCase().replace(/\s+/g, "-")}`}
      />
      <Label className="text-xs text-muted-foreground">{label}</Label>
    </div>
  );
}
