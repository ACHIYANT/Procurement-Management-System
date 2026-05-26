export default function FieldError({ message }) {
  if (!message) return null;

  return <p className="text-sm font-medium text-red-500">{message}</p>;
}
