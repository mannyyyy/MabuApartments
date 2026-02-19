"use client"

import { addDays, format, isBefore, isSameDay, startOfDay } from "date-fns"
import { CalendarIcon } from "lucide-react"
import type { DateRange as DayPickerRange } from "react-day-picker"
import type { Control } from "react-hook-form"
import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { BookingDateRange, BookingFormValues } from "@/lib/validators/booking.schema"

type DateRangePickerProps = {
  control: Control<BookingFormValues>
  dateRange: BookingDateRange
  isCalendarOpen: boolean
  unavailableDates: Date[]
  onCalendarOpenChange: (open: boolean) => void
  onDateSelect: (range: BookingDateRange | undefined) => void
}

export function DateRangePicker({
  control,
  dateRange,
  isCalendarOpen,
  unavailableDates,
  onCalendarOpenChange,
  onDateSelect,
}: DateRangePickerProps) {
  return (
    <FormField
      control={control}
      name="dateRange"
      render={({ field }) => (
        <FormItem className="flex flex-col">
          <FormLabel>Date Range</FormLabel>
          <Popover open={isCalendarOpen} onOpenChange={onCalendarOpenChange}>
            <PopoverTrigger asChild>
              <FormControl>
                <Button
                  variant={"outline"}
                  className={cn("w-full justify-start text-left font-normal", !field.value?.from && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {field.value?.from ? (
                    field.value.to ? (
                      <>
                        {format(field.value.from, "LLL dd, y")} - {format(field.value.to, "LLL dd, y")}
                      </>
                    ) : (
                      <>
                        {format(field.value.from, "LLL dd, y")}
                        <span className="text-muted-foreground"> - Select end date</span>
                      </>
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </FormControl>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-[#faf9f6]" align="center" side="bottom" sideOffset={5} alignOffset={0}>
              <div className="flex flex-col">
                <div className="p-3 border-b">
                  <div className="text-sm text-muted-foreground text-center">
                    {!dateRange.from ? "Select check-in date" : !dateRange.to ? "Select check-out date" : "Update your selection"}
                  </div>
                </div>
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={field.value?.from}
                  selected={dateRange}
                  onSelect={(range: DayPickerRange | undefined) => {
                    const normalizedRange = range ? { from: range.from, to: range.to } : undefined
                    onDateSelect(normalizedRange)
                    field.onChange(normalizedRange)
                  }}
                  numberOfMonths={2}
                  disabled={(date) => {
                    if (isBefore(date, startOfDay(new Date()))) {
                      return true
                    }

                    if (unavailableDates.some((unavailableDate) => isSameDay(date, unavailableDate))) {
                      return true
                    }

                    const prevDay = addDays(date, -1)
                    const nextDay = addDays(date, 1)
                    const isPrevDayUnavailable = unavailableDates.some((d) => isSameDay(d, prevDay))
                    const isNextDayUnavailable = unavailableDates.some((d) => isSameDay(d, nextDay))

                    return isPrevDayUnavailable && isNextDayUnavailable
                  }}
                  className="rounded-md border"
                  classNames={{
                    day_disabled: "text-gray-300 cursor-not-allowed opacity-50",
                  }}
                />
              </div>
            </PopoverContent>
          </Popover>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

