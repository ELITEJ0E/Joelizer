import * as React from 'react';
import { cn } from '../../lib/utils';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from './select';

/**
 * Compatibility layer for migrating existing native single-select controls.
 * Uses the shared shadcn/Radix Select UI and preserves each caller's
 * value/onChange API. No native HTML select is rendered.
 */
type Props = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'multiple' | 'size'> & {
  children: React.ReactNode;
};
const EMPTY = '__joelizer_empty_select_option__';

function optionsFromChildren(children: React.ReactNode): React.ReactNode[] {
  return React.Children.toArray(children).flatMap((child, index) => {
    if (!React.isValidElement(child)) return [];
    const props = child.props as {
      value?: string | number; disabled?: boolean; label?: string;
      children?: React.ReactNode;
    };
    if (child.type === React.Fragment) return optionsFromChildren(props.children);
    if (child.type === 'optgroup') {
      return [<SelectGroup key={child.key ?? `group-${index}`}>
        <SelectLabel>{props.label}</SelectLabel>
        {optionsFromChildren(props.children)}
      </SelectGroup>];
    }
    if (child.type !== 'option') return [];
    const label = props.children;
    const rawValue = props.value ?? (typeof label === 'string' || typeof label === 'number' ? label : '');
    const value = String(rawValue) === '' ? EMPTY : String(rawValue);
    return [<SelectItem key={child.key ?? `item-${index}`} value={value} disabled={props.disabled}>
      {label ?? String(rawValue)}
    </SelectItem>];
  });
}

export function StyledSelect({
  value, defaultValue, onChange, disabled, children, className, id, name,
  title, required, ...rest
}: Props) {
  const [uncontrolled, setUncontrolled] = React.useState(String(defaultValue ?? ''));
  const currentValue = value === undefined ? uncontrolled : String(value);
  const onValueChange = (next: string) => {
    const normalized = next === EMPTY ? '' : next;
    if (value === undefined) setUncontrolled(normalized);
    onChange?.({
      target: { value: normalized, name: name ?? '', id: id ?? '' },
      currentTarget: { value: normalized, name: name ?? '', id: id ?? '' }
    } as React.ChangeEvent<HTMLSelectElement>);
  };
  return (
    <Select value={currentValue === '' ? EMPTY : currentValue}
      onValueChange={onValueChange} disabled={disabled} name={name} required={required}>
      <SelectTrigger id={id} title={title}
        aria-label={rest['aria-label'] || title || name || 'Choose option'}
        className={cn('min-h-8 w-full border-[#303846] bg-[#111820] text-xs text-[#e8edf2] normal-case', className)}>
        <SelectValue placeholder="Choose option" />
      </SelectTrigger>
      <SelectContent className="z-[200] max-h-[70dvh] border-[#303846] bg-[#111820] text-[#e8edf2]">
        {optionsFromChildren(children)}
      </SelectContent>
    </Select>
  );
}
