"use client";

/**
 * Submits a (bound) server action, but only after the user confirms. Used for
 * destructive actions like permanent delete. The action prop is a server action
 * already bound to its id, e.g. `deleteEvent.bind(null, eventId)`.
 */
export function ConfirmButton({
  action,
  confirm,
  className,
  children,
}: {
  action: () => Promise<void>;
  confirm: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <form action={action}>
      <button
        type="submit"
        className={className}
        onClick={(e) => {
          if (!window.confirm(confirm)) e.preventDefault();
        }}
      >
        {children}
      </button>
    </form>
  );
}
