import React from 'react';

interface Column<T> {
  header: string;
  key: string;
  render?: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  title?: string;
  className?: string;
}

function DataTable<T>({ data, columns, title, className = '' }: DataTableProps<T>) {
  return (
    <div className={`data-table ${className}`}>
      {title && <h3>{title}</h3>}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              {columns.map((column, index) => (
                <th key={index}>{column.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item, rowIndex) => (
              <tr key={rowIndex}>
                {columns.map((column, colIndex) => (
                  <td key={`${rowIndex}-${colIndex}`}>
                    {column.render 
                      ? column.render(item)
                      : (item as any)[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <style jsx>{`
        .data-table {
          margin: 20px 0;
        }
        .table-container {
          max-width: 100%;
          margin-top: 10px;
          overflow-x: auto;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        td, th {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }
        th {
          background-color: #f5f5f5;
        }
        tr:nth-child(even) {
          background-color: #fafafa;
        }
      `}</style>
    </div>
  );
}

export default DataTable;
