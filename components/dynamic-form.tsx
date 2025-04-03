import React from "react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { cn, ValueType } from "@/src/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { EnhancedDatePicker } from "./enhanced-date-picker";
import { DynamicFormSchemaValue } from "../post-message-analysis/form-creator-core";

interface DynamicFormProps {
  schema: DynamicFormSchemaValue[];
  onSubmit: (values: any) => void;
  className?: string;
  isFullscreen?: boolean;
}

const DynamicForm: React.FC<DynamicFormProps> = ({
  schema,
  onSubmit,
  className,
  isFullscreen = false,
}) => {
  console.log("DynamicForm received schema:", schema);

  // Initialize form with default values
  const defaultValues = React.useMemo(() => {
    const values: Record<string, any> = {};
    schema.forEach((field) => {
      if (field.valueType === ValueType.ENUM) {
        values[field.key] = field.enumValues?.[0] || "";
      } else if (field.valueType === ValueType.DATE) {
        // For date fields, initialize with undefined instead of empty string
        values[field.key] = undefined;
      } else {
        values[field.key] = "";
      }
    });
    console.log("defaultValues", values);
    return values;
  }, [schema]);

  const form = useForm({
    defaultValues,
    mode: "onChange"
  });

  // Add this to track form state
  const { isValid, isSubmitting } = form.formState;

  // Group fields by their group property
  const groupedFields = React.useMemo(() => {
    const groups: { [key: string]: DynamicFormSchemaValue[] } = {};
    schema.forEach((field) => {
      const group = field.group || "default";
      if (!groups[group]) groups[group] = [];
      groups[group].push(field);
    });
    return groups;
  }, [schema]);

  const renderField = (field: DynamicFormSchemaValue) => {
    return (
      <FormField
        key={field.key}
        control={form.control}
        name={field.key}
        render={({ field: formField }) => (
          <FormItem className="w-full flex flex-col items-center justify-center gap-4">
            <FormLabel>{field.key}</FormLabel>
            <FormControl>
              {(() => {
                switch (field.valueType) {
                  case ValueType.STRING:
                    return <Input {...formField} />;

                  case ValueType.NUMBER:
                    return <Input type="number" {...formField} />;

                  case ValueType.BOOLEAN:
                    return (
                      <Switch
                        checked={formField.value}
                        onCheckedChange={formField.onChange}
                      />
                    );

                  case ValueType.DATE:
                    return (
                      <EnhancedDatePicker
                        value={formField.value}
                        onChange={formField.onChange}
                      />
                    );

                  case ValueType.ENUM:
                    return (
                      <Select
                        onValueChange={formField.onChange}
                        defaultValue={formField.value}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select an option" />
                        </SelectTrigger>
                        <SelectContent>
                          {(field.enumValues || []).map((option, i) => (
                            <SelectItem key={option} value={option}>
                              {field.enumLabels?.[i] || option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    );

                  case ValueType.FILE:
                    return (
                      <Input
                        type="file"
                        accept={field.fileTypes
                          ?.map((type) => `.${type}`)
                          .join(",")}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          formField.onChange(file);
                        }}
                      />
                    );

                  default:
                    return <Input {...formField} />;
                }
              })()}
            </FormControl>
            {field.description && (
              <FormDescription>{field.description}</FormDescription>
            )}
            <FormMessage />
          </FormItem>
        )}
      />
    );
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn(
          "space-y-8",
          isFullscreen && "fixed inset-0 bg-black/95 backdrop-blur-sm p-8 overflow-y-auto z-50",
          className
        )}
      >
        {isFullscreen && (
          <div className="flex justify-end mb-4 sticky top-0 z-50 bg-black/80 p-2 rounded-lg backdrop-blur-sm">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => document.dispatchEvent(new CustomEvent('exitFullscreen'))}
            >
              Save Form
            </Button>
          </div>
        )}
        <div className={cn(
          "space-y-6",
          isFullscreen && "pb-20" // Add padding at bottom for better scrolling
        )}>
          {Object.entries(groupedFields).map(([group, fields]) => {
            console.log("group", group, fields);
            return (
              <div key={group} className="space-y-6 p-4 rounded-lg bg-black/20">
                {group !== "default" && (
                  <h3 className="text-lg font-semibold capitalize border-b pb-2">{group}</h3>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {fields.map((field) => renderField(field))}
                </div>
              </div>
            );
          })}
          <Button 
            type="submit" 
            className={cn(
              "w-full",
              isFullscreen && "sticky bottom-4" // Make submit button stick to bottom in fullscreen
            )}
            disabled={!isValid || isSubmitting}
          >
            Submit
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default DynamicForm;
