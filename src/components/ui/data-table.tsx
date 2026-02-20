import { ReactNode, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

interface Column<T> {
  key: string;
  header: string;
  width?: string;
  align?: "left" | "center" | "right";
  sortable?: boolean;
  render?: (item: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  sortKey?: string;
  sortDirection?: "asc" | "desc";
  onSort?: (key: string) => void;
  enableColumnReorder?: boolean;
  onColumnReorder?: (fromKey: string, toKey: string) => void;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  className?: string;
}

export function DataTable<T extends { id?: string | number }>({
  columns,
  data,
  sortKey,
  sortDirection,
  onSort,
  enableColumnReorder = false,
  onColumnReorder,
  onRowClick,
  emptyMessage = "No data available",
  className,
}: DataTableProps<T>) {
  const [draggingColumnKey, setDraggingColumnKey] = useState<string | null>(null);
  const [dragOverColumnKey, setDragOverColumnKey] = useState<string | null>(null);

  const getSortIcon = (columnKey: string) => {
    if (sortKey !== columnKey) {
      return <ChevronsUpDown className="h-4 w-4 text-muted-foreground/50" />;
    }
    return sortDirection === "asc" ? (
      <ChevronUp className="h-4 w-4" />
    ) : (
      <ChevronDown className="h-4 w-4" />
    );
  };

  const alignClasses = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  };

  const handleColumnDrop = (targetKey: string) => {
    if (!enableColumnReorder) return;
    if (!draggingColumnKey || draggingColumnKey === targetKey) return;
    onColumnReorder?.(draggingColumnKey, targetKey);
  };

  return (
    <div className={cn("rounded-lg border bg-card overflow-hidden", className)}>
      <div className="w-full overflow-x-auto">
        <Table className="min-w-[560px] md:min-w-full">
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  style={{ width: column.width }}
                  className={cn(
                    "whitespace-nowrap font-semibold text-foreground",
                    alignClasses[column.align || "left"],
                    column.sortable && "cursor-pointer select-none hover:bg-muted/80",
                    enableColumnReorder && "cursor-grab active:cursor-grabbing",
                    dragOverColumnKey === column.key && "bg-muted/80"
                  )}
                  onClick={() => column.sortable && onSort?.(column.key)}
                  draggable={enableColumnReorder}
                  onDragStart={() => {
                    if (!enableColumnReorder) return;
                    setDraggingColumnKey(column.key);
                  }}
                  onDragOver={(event) => {
                    if (!enableColumnReorder || !draggingColumnKey) return;
                    event.preventDefault();
                    setDragOverColumnKey(column.key);
                  }}
                  onDrop={(event) => {
                    if (!enableColumnReorder) return;
                    event.preventDefault();
                    handleColumnDrop(column.key);
                    setDraggingColumnKey(null);
                    setDragOverColumnKey(null);
                  }}
                  onDragEnd={() => {
                    if (!enableColumnReorder) return;
                    setDraggingColumnKey(null);
                    setDragOverColumnKey(null);
                  }}
                >
                  <div className={cn(
                    "flex items-center gap-1",
                    column.align === "right" && "justify-end",
                    column.align === "center" && "justify-center"
                  )}>
                    {column.header}
                    {column.sortable && getSortIcon(column.key)}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              data.map((item, index) => (
                <TableRow
                  key={item.id ?? index}
                  onClick={() => onRowClick?.(item)}
                  className={cn(
                    "transition-colors",
                    onRowClick && "cursor-pointer hover:bg-muted/50"
                  )}
                >
                  {columns.map((column) => (
                    <TableCell
                      key={column.key}
                      className={alignClasses[column.align || "left"]}
                    >
                      {column.render
                        ? column.render(item)
                        : (item as Record<string, unknown>)[column.key] as ReactNode}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
