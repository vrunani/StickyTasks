; Extra messages for the installer / uninstaller (used by electron-builder).

!macro customUnInstall
  ${ifNot} ${isUpdated}
    MessageBox MB_YESNO|MB_ICONQUESTION "Thanks for trying StickyTasks!$\r$\n$\r$\nYour saved tasks are kept on this PC (in your AppData folder).$\r$\n$\r$\nWould you like to tell us why you are leaving, or suggest an idea? This opens your browser." IDNO stickyNoFeedback
      ExecShell "open" "https://github.com/vrunani/stickytasks/issues/new"
    stickyNoFeedback:
  ${endIf}
!macroend
