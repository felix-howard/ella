import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/utils'
import { User } from 'lucide-react'

const avatarVariants = cva(
  'relative inline-flex items-center justify-center rounded-full overflow-hidden bg-primary-light text-primary font-medium shrink-0',
  {
    variants: {
      size: {
        xs: 'h-6 w-6 text-xs',
        sm: 'h-8 w-8 text-sm',
        default: 'h-10 w-10 text-sm',
        lg: 'h-12 w-12 text-base',
        xl: 'h-16 w-16 text-lg',
        '2xl': 'h-20 w-20 text-xl',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  }
)

const avatarIconSizes = {
  xs: 'h-3 w-3',
  sm: 'h-4 w-4',
  default: 'h-5 w-5',
  lg: 'h-6 w-6',
  xl: 'h-8 w-8',
  '2xl': 'h-10 w-10',
}

export interface AvatarProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof avatarVariants> {
  src?: string | null
  alt?: string
  fallback?: string
}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, alt, fallback, size = 'default', ...props }, ref) => {
    const [imageError, setImageError] = React.useState(false)

    // Reset error state when src changes
    React.useEffect(() => {
      setImageError(false)
    }, [src])

    const renderFallback = () => {
      if (fallback) {
        // Get initials from fallback text (first letter or first two letters)
        const initials = fallback
          .split(' ')
          .map((word) => word[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)
        return <span>{initials}</span>
      }
      return <User className={cn(avatarIconSizes[size ?? 'default'])} />
    }

    return (
      <div ref={ref} className={cn(avatarVariants({ size }), className)} {...props}>
        {src && !imageError ? (
          <img
            src={src}
            alt={alt || fallback || 'Avatar'}
            className="h-full w-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          renderFallback()
        )}
      </div>
    )
  }
)
Avatar.displayName = 'Avatar'

// Avatar Group for displaying multiple avatars
export interface AvatarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  max?: number
  size?: VariantProps<typeof avatarVariants>['size']
  children: React.ReactNode
}

const AvatarGroup = React.forwardRef<HTMLDivElement, AvatarGroupProps>(
  ({ className, max = 4, size = 'default', children, ...props }, ref) => {
    const childArray = React.Children.toArray(children)
    const visibleChildren = childArray.slice(0, max)
    const remainingCount = childArray.length - max

    return (
      <div ref={ref} className={cn('flex -space-x-2', className)} {...props}>
        {visibleChildren.map((child, index) => (
          <div key={index} className="ring-2 ring-card rounded-full">
            {React.isValidElement(child)
              ? React.cloneElement(child as React.ReactElement<AvatarProps>, { size })
              : child}
          </div>
        ))}
        {remainingCount > 0 && (
          <div
            className={cn(
              avatarVariants({ size }),
              'ring-2 ring-card bg-muted text-secondary'
            )}
          >
            <span>+{remainingCount}</span>
          </div>
        )}
      </div>
    )
  }
)
AvatarGroup.displayName = 'AvatarGroup'

export { Avatar, AvatarGroup, avatarVariants }
