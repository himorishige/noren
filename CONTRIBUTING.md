# Contributing to Noren

Thank you for your interest in contributing to Noren! We welcome all contributions from the community. By participating, you are expected to uphold our [Code of Conduct](#code-of-conduct).

## How to Contribute

We welcome various forms of contributions, including:
- **Reporting Bugs**: Filing detailed bug reports.
- **Suggesting Enhancements**: Proposing new features or improvements.
- **Submitting Pull Requests**: Contributing code, documentation, or tests.

Please use the [GitHub Issues](https://github.com/himorishige/noren/issues) page for bug reports and feature suggestions. For code contributions, please use [GitHub Pull Requests](https://github.com/himorishige/noren/pulls).

## Development Setup

To get started with the development, please follow these steps:

1.  **Fork & Clone**: Fork the repository to your own GitHub account and then clone it to your local machine.
    ```sh
    git clone https://github.com/<YOUR_USERNAME>/noren.git
    cd noren
    ```

2.  **Install Dependencies**: This project uses `pnpm` for package management. Make sure you have it installed.
    ```sh
    pnpm install
    ```

3.  **Build the Project**: Build all packages within the monorepo.
    ```sh
    pnpm build
    ```

## Making Changes

1.  **Create a Branch**: Create a new branch for your changes.
    ```sh
    git checkout -b my-feature-or-fix
    ```

2.  **Implement Changes**: Make your desired changes to the code or documentation. The source code is located in the `packages/` directory.

3.  **Run Checks**: Before committing, ensure all tests and quality checks pass.
    ```sh
    # Run tests for all packages
    pnpm test

    # Run linter and formatter checks
    pnpm check
    ```
    To automatically fix formatting issues, you can run:
    ```sh
    pnpm format
    ```

## Submitting a Pull Request

1.  Push your changes to your forked repository.
2.  Open a pull request to the `main` branch of the original repository.
3.  Provide a clear title and a detailed description of your changes in the pull request. Link to any relevant issues.
4.  A maintainer will review your pull request, provide feedback, and merge it once it's ready.

## Code of Conduct

All contributors are expected to follow the project's [Code of Conduct](./CODE_OF_CONDUCT.md). Please make sure you are familiar with its contents.

## License

By contributing, you agree that your contributions will be licensed under the **MIT License** that covers the project. You represent that you have the right to grant this license for your contributions.