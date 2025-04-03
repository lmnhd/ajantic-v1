"use client";

import * as React from "react";
import { format, parse, isValid } from "date-fns";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/src/lib/utils";

interface EnhancedDatePickerProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  disabled?: boolean;
  className?: string;
}

export function EnhancedDatePicker({
  value,
  onChange,
  disabled,
  className,
}: EnhancedDatePickerProps) {
  // Ensure value is a valid Date object
  const isValidDate = (val: any): val is Date => {
    return val instanceof Date && !isNaN(val.getTime());
  };

  const currentDate = new Date();
  const validValue = isValidDate(value) ? value : undefined;
  
  const [isOpen, setIsOpen] = React.useState(false);
  const [dateInput, setDateInput] = React.useState(validValue ? format(validValue, "yyyy-MM-dd") : "");
  const [selectedMonth, setSelectedMonth] = React.useState<number>(
    validValue ? validValue.getMonth() : currentDate.getMonth()
  );
  const [selectedYear, setSelectedYear] = React.useState<number>(
    validValue ? validValue.getFullYear() : currentDate.getFullYear()
  );
  
  // Generate years for dropdown (100 years back from current year)
  const currentYear = currentDate.getFullYear();
  const years = Array.from({ length: 150 }, (_, i) => currentYear - 149 + i);
  
  // Generate months for dropdown
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Update date input when value changes externally
  React.useEffect(() => {
    if (isValidDate(value)) {
      setDateInput(format(value, "yyyy-MM-dd"));
      setSelectedMonth(value.getMonth());
      setSelectedYear(value.getFullYear());
    }
  }, [value]);

  // Handle direct date input
  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDateInput(e.target.value);
    
    // Try to parse the date as the user types
    if (e.target.value && e.target.value.length === 10) { // Format: YYYY-MM-DD
      try {
        const parsedDate = parse(e.target.value, "yyyy-MM-dd", new Date());
        if (!isNaN(parsedDate.getTime())) {
          onChange(parsedDate);
          setSelectedMonth(parsedDate.getMonth());
          setSelectedYear(parsedDate.getFullYear());
        }
      } catch (error) {
        // Silently fail, will handle on blur
      }
    }
  };

  const handleDateInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleDateInputBlur();
      setIsOpen(false);
    }
  };

  const handleDateInputBlur = () => {
    if (dateInput) {
      try {
        // Try to parse the input date
        const parsedDate = parse(dateInput, "yyyy-MM-dd", new Date());
        
        // Check if it's a valid date
        if (!isNaN(parsedDate.getTime())) {
          onChange(parsedDate);
          setSelectedMonth(parsedDate.getMonth());
          setSelectedYear(parsedDate.getFullYear());
        }
      } catch (error) {
        // Reset to current value if parsing fails
        if (validValue) {
          setDateInput(format(validValue, "yyyy-MM-dd"));
        } else {
          setDateInput("");
        }
      }
    }
  };

  // Handle month selection
  const handleMonthChange = (newMonth: string) => {
    const monthIndex = months.findIndex(month => month === newMonth);
    if (monthIndex !== -1) {
      setSelectedMonth(monthIndex);
      
      // Update the calendar view
      const newDate = new Date(selectedYear, monthIndex, 1);
      if (validValue) {
        // Keep the day from the currently selected date
        newDate.setDate(validValue.getDate());
        // If the day doesn't exist in the new month, it will automatically adjust to the last day
        onChange(newDate);
      }
    }
  };

  // Handle year selection
  const handleYearChange = (newYear: string) => {
    const year = parseInt(newYear, 10);
    setSelectedYear(year);
    
    // Update the calendar view
    const newDate = new Date(year, selectedMonth, 1);
    if (validValue) {
      // Keep the day from the currently selected date
      newDate.setDate(validValue.getDate());
      // If the day doesn't exist in the new month, it will automatically adjust to the last day
      onChange(newDate);
    }
  };

  // Handle calendar date selection
  const handleCalendarSelect = (date: Date | undefined) => {
    onChange(date);
    setIsOpen(false);
    if (date && isValidDate(date)) {
      setDateInput(format(date, "yyyy-MM-dd"));
      setSelectedMonth(date.getMonth());
      setSelectedYear(date.getFullYear());
    }
  };

  return (
    <div className={cn("w-full", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-start text-left font-normal",
              !validValue && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {validValue ? format(validValue, "PPP") : <span>Pick a date</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-3 border-b">
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Select 
                  value={months[selectedMonth]} 
                  onValueChange={handleMonthChange}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((month) => (
                      <SelectItem key={month} value={month}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select 
                  value={selectedYear.toString()} 
                  onValueChange={handleYearChange}
                >
                  <SelectTrigger className="w-[100px]">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent className="h-80">
                    {years.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <Input
                type="date"
                value={dateInput}
                onChange={handleDateInputChange}
                onKeyDown={handleDateInputKeyDown}
                onBlur={handleDateInputBlur}
                placeholder="YYYY-MM-DD"
                className="w-full"
              />
            </div>
          </div>
          
          <Calendar
            mode="single"
            selected={validValue}
            onSelect={handleCalendarSelect}
            month={new Date(selectedYear, selectedMonth)}
            defaultMonth={new Date(selectedYear, selectedMonth)}
            disabled={(date) =>
              date > new Date() || date < new Date("1800-01-01")
            }
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
} 