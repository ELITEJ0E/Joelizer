import "@heroui/styles/css";
import React from "react";
import { 
  ColorPicker as HeroColorPicker, 
  ColorPickerTrigger as HeroColorPickerTrigger, 
  ColorPickerPopover as HeroColorPickerPopover 
} from "@heroui/react";

export const ColorPickerTrigger = HeroColorPickerTrigger as React.FC<{
  children?: React.ReactNode;
  className?: string;
  [key: string]: any;
}>;

export const ColorPickerPopover = HeroColorPickerPopover as React.FC<{
  children?: React.ReactNode;
  className?: string;
  placement?: string;
  [key: string]: any;
}>;

export const ColorPicker = Object.assign(HeroColorPicker as any, {
  Trigger: ColorPickerTrigger,
  Popover: ColorPickerPopover,
});

export { HeroColorPicker, HeroColorPickerTrigger, HeroColorPickerPopover };
export default ColorPicker;
