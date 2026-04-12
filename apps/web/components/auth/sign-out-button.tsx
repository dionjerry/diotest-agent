import { signOutAction } from '@/app/actions';
import { Button } from '@/components/ui/button';

type SignOutButtonProps = {
  className?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
};

export function SignOutButton({
  className,
  variant = 'ghost',
  size = 'md',
}: SignOutButtonProps) {
  return (
    <form action={signOutAction}>
      <Button type="submit" variant={variant} size={size} className={className}>
        Sign out
      </Button>
    </form>
  );
}
