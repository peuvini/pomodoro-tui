import React from "react";
import { Box, Text } from "ink";
import type { Task } from "../tasks";

interface TaskItemProps {
  task: Task;
  selected: boolean;
}

function TaskItem({ task, selected }: TaskItemProps) {
  const checkbox = task.completed ? "[x]" : "[ ]";
  const prefix = selected ? "> " : "  ";
  const textColor = task.completed ? "gray" : "white";

  return (
    <Text color={selected ? "cyan" : textColor}>
      {prefix}{checkbox} {task.text}
    </Text>
  );
}

interface TaskListProps {
  tasks: Task[];
  selectedIndex: number;
  addMode: boolean;
  taskInput: string;
}

export function TaskList({ tasks, selectedIndex, addMode, taskInput }: TaskListProps) {
  const pending = tasks.filter(t => !t.completed);
  const completed = tasks.filter(t => t.completed);

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      paddingY={0}
      width={30}
    >
      <Box marginBottom={1}>
        <Text bold color="cyan">TO DO</Text>
      </Box>

      {pending.length === 0 && !addMode && (
        <Text dimColor>  No tasks yet</Text>
      )}

      {pending.map((task, i) => (
        <TaskItem key={task.id} task={task} selected={i === selectedIndex} />
      ))}

      {addMode && (
        <Box>
          <Text color="yellow">&gt; [ ] {taskInput}_</Text>
        </Box>
      )}

      <Box marginTop={1} marginBottom={1}>
        <Text bold color="gray">DONE</Text>
      </Box>

      {completed.length === 0 && (
        <Text dimColor>  None completed</Text>
      )}

      {completed.map((task, i) => (
        <TaskItem
          key={task.id}
          task={task}
          selected={pending.length + i === selectedIndex}
        />
      ))}

      <Box marginTop={1}>
        <Text dimColor>[a]dd [d]el [↑↓] [Space]</Text>
      </Box>
    </Box>
  );
}
