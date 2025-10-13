# Contributing Guidelines

## Development Setup

1. **Clone and Install**
   ```bash
   git clone <repository>
   cd crisp-alpha
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env.local
   # Fill in your API keys and configuration
   ```

3. **Development Server**
   ```bash
   npm run dev
   ```

## Code Quality Standards

### Pre-commit Checklist
Run before every commit:
```bash
npm run precommit
```

This runs:
- TypeScript type checking
- Prettier formatting check
- ESLint with zero warnings

### Code Style
- **Prettier**: Auto-format on save
- **ESLint**: Zero warnings policy
- **TypeScript**: Strict mode enabled
- **Imports**: Use absolute imports from `src/`

### File Organization
```
src/
├── app/           # Next.js app router
├── components/    # React components
├── lib/          # Utilities and shared logic
└── workers/      # Web workers
```

## Branch Naming

Use descriptive branch names:
- `feature/description` - New features
- `fix/description` - Bug fixes
- `refactor/description` - Code refactoring
- `docs/description` - Documentation updates

## Commit Messages

Follow conventional commits:
```
type(scope): description

feat(api): add request validation
fix(middleware): handle missing origin header
refactor(log): improve error redaction
docs(api): update endpoint documentation
```

## Pull Request Process

### Before Submitting
1. Run all quality checks: `npm run precommit`
2. Ensure tests pass: `npm run test`
3. Update documentation if needed
4. Test the feature thoroughly

### Review Checklist
- [ ] Code follows style guidelines
- [ ] TypeScript types are properly defined
- [ ] Error handling is comprehensive
- [ ] Logging is structured and appropriate
- [ ] Security considerations addressed
- [ ] Performance impact considered
- [ ] Documentation updated

## Testing

### Unit Tests
```bash
npm run test        # Run once
npm run test:watch  # Watch mode
npm run test:ci     # CI mode with coverage
```

### Test Structure
```
src/
├── lib/
│   └── __tests__/
│       ├── env.test.ts
│       ├── http.test.ts
│       └── log.test.ts
└── app/
    └── api/
        └── transcribe/
            └── __tests__/
                └── route.test.ts
```

### Test Requirements
- Unit tests for all utility functions
- Integration tests for API routes
- Mock external dependencies
- Test error scenarios

## Security Guidelines

### Never Commit
- API keys or secrets
- Environment files (except `.env.example`)
- Personal data or PII

### Security Checklist
- [ ] Input validation with Zod
- [ ] Output sanitization
- [ ] Rate limiting implemented
- [ ] Error messages don't leak information
- [ ] Logs don't contain sensitive data

## Performance Guidelines

### Bundle Size
- Monitor bundle size: `< 120 kB JS`
- Use dynamic imports for large dependencies
- Optimize images and fonts
- Tree-shake unused code

### Runtime Performance
- Use React.memo for expensive components
- Implement proper loading states
- Optimize API response times
- Monitor Core Web Vitals

## Dependency Management

### Adding Dependencies
1. Justify the addition
2. Check bundle size impact
3. Verify security audit: `npm audit`
4. Update documentation if needed

### Quarterly Audit
- Run `npm audit --production`
- Review and update dependencies
- Document any security issues
- Plan migration for deprecated packages

## Deployment

### Environment Variables
Required in production:
- `DEEPGRAM_API_KEY`
- `GEMINI_API_KEY`
- `NEXT_PUBLIC_BASE_URL`
- `NODE_ENV=production`

### Build Process
```bash
npm run build    # Production build
npm run start    # Start production server
```

### Monitoring
- Check application logs
- Monitor error rates
- Track performance metrics
- Verify security headers

## Troubleshooting

### Common Issues

**TypeScript Errors**
```bash
npm run typecheck
```

**ESLint Warnings**
```bash
npm run lint
```

**Formatting Issues**
```bash
npm run format
```

**Environment Issues**
- Verify `.env.local` exists
- Check all required variables are set
- Ensure API keys are valid

### Getting Help
1. Check existing documentation
2. Search closed issues
3. Create detailed issue with:
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details
   - Error logs (redacted)

## Code Review Guidelines

### For Reviewers
- Focus on logic and security
- Check for performance implications
- Verify error handling
- Ensure documentation is updated
- Test the changes locally

### For Authors
- Keep PRs focused and small
- Provide clear description
- Include relevant tests
- Respond to feedback promptly
- Update documentation as needed
